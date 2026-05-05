"""
Hybrid Keyword Research Tool
Google Ads API + Google Autocomplete + Gemini LSI/Long-Tail Expansion

Auto-detects geo targets from the client's active campaigns. Falls back to
--location_ids only if the account has no campaign-level location targeting.

Usage:
  python keyword_research.py --customer_id 1234567890 --keywords "dental implants" "cosmetic dentist"
  python keyword_research.py --customer_id 1234567890 --keywords "dental implants" --page_url https://example.com --output results.csv
  python keyword_research.py --customer_id 1234567890 --keywords "dental implants" --location_ids 1025197  # manual override

Requires:
  - google-ads.yaml in home directory (Google Ads API credentials)
  - GEMINI_API_KEY env var or --gemini_key flag
"""

import argparse
import csv
import json
import os
import sys
import time
import urllib.request
import urllib.parse
from pathlib import Path
from dataclasses import dataclass, field


# ---------------------------------------------------------------------------
# Google Ads API — Auto-detect geo targets from active campaigns
# ---------------------------------------------------------------------------

def _get_ads_client():
    from google.ads.googleads.client import GoogleAdsClient
    return GoogleAdsClient.load_from_storage(version="v23")


def detect_campaign_locations(customer_id, client=None):
    """Pull geo targets from the client's active/enabled campaigns.

    Returns a dict: {location_id: location_name, ...}
    Falls back to empty dict if nothing found.
    """
    if client is None:
        client = _get_ads_client()

    ga_service = client.get_service("GoogleAdsService")

    # Query location targets from enabled campaigns
    query = """
        SELECT
            campaign.id,
            campaign.name,
            campaign.status,
            campaign_criterion.location.geo_target_constant,
            campaign_criterion.negative
        FROM campaign_criterion
        WHERE campaign_criterion.type = 'LOCATION'
          AND campaign.status = 'ENABLED'
          AND campaign_criterion.negative = FALSE
    """

    locations = {}
    try:
        response = ga_service.search(customer_id=customer_id, query=query)
        geo_constants = set()
        for row in response:
            geo_rn = row.campaign_criterion.location.geo_target_constant
            geo_constants.add(geo_rn)

        # Resolve geo target constant resource names to IDs and display names
        if geo_constants:
            for geo_rn in geo_constants:
                # Resource name format: geoTargetConstants/1025197
                geo_id = geo_rn.split("/")[-1]
                locations[geo_id] = geo_rn

            # Fetch display names
            geo_ids_str = ", ".join(f"'{gid}'" for gid in locations.keys())
            name_query = f"""
                SELECT
                    geo_target_constant.resource_name,
                    geo_target_constant.id,
                    geo_target_constant.name,
                    geo_target_constant.canonical_name,
                    geo_target_constant.target_type
                FROM geo_target_constant
                WHERE geo_target_constant.id IN ({', '.join(locations.keys())})
            """
            name_response = ga_service.search(customer_id=customer_id, query=name_query)
            resolved = {}
            for row in name_response:
                gtc = row.geo_target_constant
                resolved[str(gtc.id)] = {
                    "name": gtc.name,
                    "canonical_name": gtc.canonical_name,
                    "target_type": gtc.target_type_.name if hasattr(gtc, 'target_type_') else "",
                }
            return resolved

    except Exception as e:
        print(f"[Geo Detect] Error querying campaign locations: {e}")

    return locations


def detect_ad_destination_urls(customer_id, client=None):
    """Pull final URLs from active ads to show where traffic is being sent."""
    if client is None:
        client = _get_ads_client()

    ga_service = client.get_service("GoogleAdsService")

    query = """
        SELECT
            ad_group_ad.ad.final_urls,
            ad_group_ad.ad.name,
            campaign.name
        FROM ad_group_ad
        WHERE campaign.status = 'ENABLED'
          AND ad_group.status = 'ENABLED'
          AND ad_group_ad.status = 'ENABLED'
        LIMIT 50
    """

    urls = set()
    try:
        response = ga_service.search(customer_id=customer_id, query=query)
        for row in response:
            for url in row.ad_group_ad.ad.final_urls:
                urls.add(url)
    except Exception as e:
        print(f"[URL Detect] Error querying ad URLs: {e}")

    return sorted(urls)


# ---------------------------------------------------------------------------
# Google Ads API — Keyword Planner Ideas
# ---------------------------------------------------------------------------

def get_keyword_ideas(customer_id, keywords, page_url, location_ids, language_id, client=None):
    """Pull keyword ideas from Google Ads KeywordPlanIdeaService."""
    from google.ads.googleads.errors import GoogleAdsException

    if client is None:
        client = _get_ads_client()

    kp_service = client.get_service("KeywordPlanIdeaService")
    ga_service = client.get_service("GoogleAdsService")
    geo_service = client.get_service("GeoTargetConstantService")

    location_rns = [geo_service.geo_target_constant_path(lid) for lid in location_ids]
    language_rn = ga_service.language_constant_path(language_id)

    request = client.get_type("GenerateKeywordIdeasRequest")
    request.customer_id = customer_id
    request.language = language_rn
    request.geo_target_constants.extend(location_rns)
    request.include_adult_keywords = False
    request.keyword_plan_network = client.enums.KeywordPlanNetworkEnum.GOOGLE_SEARCH_AND_PARTNERS

    if keywords and page_url:
        request.keyword_and_url_seed.url = page_url
        request.keyword_and_url_seed.keywords.extend(keywords)
    elif keywords:
        request.keyword_seed.keywords.extend(keywords)
    elif page_url:
        request.url_seed.url = page_url
    else:
        raise ValueError("Provide at least --keywords or --page_url")

    results = []
    try:
        ideas = kp_service.generate_keyword_ideas(request=request)
        for idea in ideas:
            metrics = idea.keyword_idea_metrics
            results.append({
                "keyword": idea.text,
                "avg_monthly_searches": metrics.avg_monthly_searches,
                "competition": metrics.competition.name,
                "competition_index": metrics.competition_index,
                "low_top_of_page_bid": metrics.low_top_of_page_bid_micros / 1_000_000 if metrics.low_top_of_page_bid_micros else 0,
                "high_top_of_page_bid": metrics.high_top_of_page_bid_micros / 1_000_000 if metrics.high_top_of_page_bid_micros else 0,
                "source": "google_ads_api",
            })
    except GoogleAdsException as ex:
        print(f"[Google Ads API Error] {ex.error.code().name}")
        for error in ex.failure.errors:
            print(f"  -> {error.message}")
        return []

    print(f"[Google Ads API] Retrieved {len(results)} keyword ideas")
    return results


# ---------------------------------------------------------------------------
# Google Autocomplete — Free suggestion scraping
# ---------------------------------------------------------------------------

AUTOCOMPLETE_URL = "https://suggestqueries.google.com/complete/search?client=firefox&q={}"

def get_autocomplete_suggestions(seed_keywords, prefixes=None):
    """Scrape Google Autocomplete for each seed keyword + optional prefixes."""
    if prefixes is None:
        prefixes = ["", "how to ", "best ", "cheap ", "top ", "why ", "what is "]

    all_suggestions = set()
    for kw in seed_keywords:
        for prefix in prefixes:
            query = f"{prefix}{kw}".strip()
            url = AUTOCOMPLETE_URL.format(urllib.parse.quote(query))
            try:
                req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})
                with urllib.request.urlopen(req, timeout=10) as resp:
                    data = json.loads(resp.read().decode("utf-8"))
                    if len(data) > 1 and isinstance(data[1], list):
                        for suggestion in data[1]:
                            all_suggestions.add(suggestion.strip().lower())
                time.sleep(0.3)  # polite delay
            except Exception as e:
                print(f"[Autocomplete] Error for '{query}': {e}")

    results = [{"keyword": s, "source": "autocomplete"} for s in sorted(all_suggestions)]
    print(f"[Autocomplete] Retrieved {len(results)} suggestions")
    return results


# ---------------------------------------------------------------------------
# Gemini — LSI expansion + keyword clustering
# ---------------------------------------------------------------------------

def expand_with_gemini(seed_keywords, ads_keywords, autocomplete_keywords, api_key):
    """Use Gemini to find LSI terms, long-tail variations, and cluster everything."""
    import google.generativeai as genai

    genai.configure(api_key=api_key)
    model = genai.GenerativeModel("gemini-2.0-flash")

    # Collect unique keywords for context
    all_kws = set(seed_keywords)
    for kw in ads_keywords[:100]:  # cap to avoid token overflow
        all_kws.add(kw["keyword"])
    for kw in autocomplete_keywords[:100]:
        all_kws.add(kw["keyword"])

    prompt = f"""You are an expert Google Ads keyword researcher for a digital marketing agency.

Given these seed keywords and related terms, do two things:

1. **EXPAND**: Generate 30-50 additional keywords NOT already in the list. Focus on:
   - LSI (Latent Semantic Indexing) terms
   - Long-tail variations (3-6 words) with commercial/transactional intent
   - "Near me" and local variations
   - Question-based keywords (who, what, where, how much)
   - Comparison keywords (vs, alternative, best)
   - Cost/price keywords
   Do NOT include generic informational keywords with no buying intent.

2. **CLUSTER**: Group ALL keywords (existing + new) into themed ad group clusters.
   Each cluster should have a name suitable for a Google Ads ad group.

Existing keywords:
{json.dumps(sorted(all_kws), indent=2)}

Respond in this exact JSON format:
{{
  "new_keywords": ["keyword1", "keyword2", ...],
  "clusters": {{
    "Ad Group Name 1": ["keyword1", "keyword2", ...],
    "Ad Group Name 2": ["keyword3", "keyword4", ...]
  }}
}}

Return ONLY valid JSON, no markdown fences, no explanation."""

    try:
        response = model.generate_content(prompt)
        text = response.text.strip()
        # Strip markdown fences if present
        if text.startswith("```"):
            text = text.split("\n", 1)[1]
            if text.endswith("```"):
                text = text.rsplit("```", 1)[0]
        parsed = json.loads(text)

        new_kws = [{"keyword": k, "source": "gemini_expansion"} for k in parsed.get("new_keywords", [])]
        clusters = parsed.get("clusters", {})

        print(f"[Gemini] Generated {len(new_kws)} new keywords across {len(clusters)} clusters")
        return new_kws, clusters

    except Exception as e:
        print(f"[Gemini] Error: {e}")
        return [], {}


# ---------------------------------------------------------------------------
# Merge + deduplicate + export
# ---------------------------------------------------------------------------

@dataclass
class MergedKeyword:
    keyword: str
    avg_monthly_searches: int = 0
    competition: str = ""
    competition_index: int = 0
    low_top_of_page_bid: float = 0.0
    high_top_of_page_bid: float = 0.0
    sources: list = field(default_factory=list)
    cluster: str = ""


def merge_results(ads_keywords, autocomplete_keywords, gemini_keywords, clusters):
    """Merge all keyword sources, deduplicate, and assign clusters."""
    merged = {}

    # Ads API results (have metrics)
    for kw in ads_keywords:
        key = kw["keyword"].lower().strip()
        merged[key] = MergedKeyword(
            keyword=key,
            avg_monthly_searches=kw.get("avg_monthly_searches", 0),
            competition=kw.get("competition", ""),
            competition_index=kw.get("competition_index", 0),
            low_top_of_page_bid=kw.get("low_top_of_page_bid", 0),
            high_top_of_page_bid=kw.get("high_top_of_page_bid", 0),
            sources=["google_ads_api"],
        )

    # Autocomplete (no metrics, just presence)
    for kw in autocomplete_keywords:
        key = kw["keyword"].lower().strip()
        if key in merged:
            if "autocomplete" not in merged[key].sources:
                merged[key].sources.append("autocomplete")
        else:
            merged[key] = MergedKeyword(keyword=key, sources=["autocomplete"])

    # Gemini expansion (no metrics)
    for kw in gemini_keywords:
        key = kw["keyword"].lower().strip()
        if key in merged:
            if "gemini" not in merged[key].sources:
                merged[key].sources.append("gemini")
        else:
            merged[key] = MergedKeyword(keyword=key, sources=["gemini"])

    # Assign cluster labels
    for cluster_name, kws in clusters.items():
        for kw in kws:
            key = kw.lower().strip()
            if key in merged:
                merged[key].cluster = cluster_name

    return sorted(merged.values(), key=lambda x: x.avg_monthly_searches, reverse=True)


def export_csv(merged_keywords, output_path):
    """Export merged keywords to CSV."""
    fieldnames = [
        "keyword", "avg_monthly_searches", "competition", "competition_index",
        "low_top_of_page_bid", "high_top_of_page_bid", "sources", "cluster"
    ]
    with open(output_path, "w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=fieldnames)
        writer.writeheader()
        for kw in merged_keywords:
            writer.writerow({
                "keyword": kw.keyword,
                "avg_monthly_searches": kw.avg_monthly_searches,
                "competition": kw.competition,
                "competition_index": kw.competition_index,
                "low_top_of_page_bid": f"${kw.low_top_of_page_bid:.2f}",
                "high_top_of_page_bid": f"${kw.high_top_of_page_bid:.2f}",
                "sources": " | ".join(kw.sources),
                "cluster": kw.cluster,
            })
    print(f"\nExported {len(merged_keywords)} keywords to {output_path}")


def export_clusters(clusters, output_path):
    """Export cluster mapping as JSON for ad group planning."""
    with open(output_path, "w", encoding="utf-8") as f:
        json.dump(clusters, f, indent=2)
    print(f"Exported {len(clusters)} ad group clusters to {output_path}")


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

def main():
    parser = argparse.ArgumentParser(description="Hybrid Keyword Research: Google Ads API + Autocomplete + Gemini")
    parser.add_argument("-c", "--customer_id", required=True, help="Google Ads customer ID (no dashes)")
    parser.add_argument("-k", "--keywords", nargs="+", required=False, default=[], help="Seed keywords")
    parser.add_argument("-p", "--page_url", default=None, help="Page URL for keyword ideas")
    parser.add_argument("-l", "--location_ids", nargs="+", default=None, help="Geo target IDs (auto-detected from campaigns if omitted)")
    parser.add_argument("-i", "--language_id", default="1000", help="Language ID (default: 1000 = English)")
    parser.add_argument("-g", "--gemini_key", default=None, help="Gemini API key (or set GEMINI_API_KEY env var)")
    parser.add_argument("-o", "--output", default="keyword_research_results.csv", help="Output CSV path")
    parser.add_argument("--skip_ads", action="store_true", help="Skip Google Ads API (autocomplete + Gemini only)")
    parser.add_argument("--skip_gemini", action="store_true", help="Skip Gemini expansion")
    args = parser.parse_args()

    if not args.keywords and not args.page_url:
        parser.error("Provide at least --keywords or --page_url")

    seed_keywords = args.keywords if args.keywords else []

    # Shared client instance
    client = None
    if not args.skip_ads:
        client = _get_ads_client()

    # --- Auto-detect locations from the client's campaigns ---
    location_ids = args.location_ids
    if location_ids is None and not args.skip_ads:
        print("[Geo Detect] Reading location targets from active campaigns...")
        detected = detect_campaign_locations(args.customer_id, client)
        if detected:
            location_ids = list(detected.keys())
            print(f"[Geo Detect] Found {len(location_ids)} location target(s):")
            for lid, info in detected.items():
                if isinstance(info, dict):
                    print(f"  -> {lid}: {info.get('canonical_name', info.get('name', 'unknown'))}")
                else:
                    print(f"  -> {lid}")
        else:
            print("[Geo Detect] No campaign-level location targets found.")
            print("[Geo Detect] ERROR: Cannot proceed without location targets.")
            print("[Geo Detect] Use --location_ids to specify manually.")
            sys.exit(1)

    elif location_ids is None:
        print("[Geo Detect] Ads API skipped and no --location_ids provided.")
        print("[Geo Detect] ERROR: Use --location_ids to specify manually.")
        sys.exit(1)

    # --- Show ad destination URLs for context ---
    if not args.skip_ads:
        print("\n[URL Detect] Checking ad destination URLs...")
        dest_urls = detect_ad_destination_urls(args.customer_id, client)
        if dest_urls:
            print(f"[URL Detect] Active ads point to {len(dest_urls)} URL(s):")
            for url in dest_urls[:10]:
                print(f"  -> {url}")
            if len(dest_urls) > 10:
                print(f"  ... and {len(dest_urls) - 10} more")
        else:
            print("[URL Detect] No active ad destination URLs found.")

    print(f"\n{'='*60}")
    print(f"  Hybrid Keyword Research Tool")
    print(f"  Seeds: {seed_keywords}")
    print(f"  URL: {args.page_url or 'N/A'}")
    print(f"  Location IDs: {location_ids}")
    print(f"{'='*60}\n")

    # Step 1: Google Ads API
    ads_keywords = []
    if not args.skip_ads:
        print("[Step 1/3] Fetching Google Ads Keyword Planner ideas...")
        ads_keywords = get_keyword_ideas(
            args.customer_id, seed_keywords, args.page_url,
            location_ids, args.language_id, client
        )
    else:
        print("[Step 1/3] Skipping Google Ads API")

    # Step 2: Google Autocomplete
    print("\n[Step 2/3] Scraping Google Autocomplete suggestions...")
    autocomplete_keywords = get_autocomplete_suggestions(seed_keywords)

    # Step 3: Gemini expansion + clustering
    gemini_keywords = []
    clusters = {}
    gemini_key = args.gemini_key or os.environ.get("GEMINI_API_KEY")
    if not args.skip_gemini and gemini_key:
        print("\n[Step 3/3] Expanding with Gemini + clustering...")
        gemini_keywords, clusters = expand_with_gemini(
            seed_keywords, ads_keywords, autocomplete_keywords, gemini_key
        )
    elif not gemini_key:
        print("\n[Step 3/3] Skipping Gemini (no API key — set GEMINI_API_KEY or use --gemini_key)")
    else:
        print("\n[Step 3/3] Skipping Gemini (--skip_gemini)")

    # Merge + export
    print("\n[Merging] Deduplicating and merging all sources...")
    merged = merge_results(ads_keywords, autocomplete_keywords, gemini_keywords, clusters)

    output_path = Path(args.output)
    export_csv(merged, output_path)

    if clusters:
        clusters_path = output_path.with_name(output_path.stem + "_clusters.json")
        export_clusters(clusters, clusters_path)

    # Summary
    ads_only = sum(1 for k in merged if k.sources == ["google_ads_api"])
    auto_only = sum(1 for k in merged if k.sources == ["autocomplete"])
    gemini_only = sum(1 for k in merged if k.sources == ["gemini"])
    multi = sum(1 for k in merged if len(k.sources) > 1)

    print(f"\n{'='*60}")
    print(f"  SUMMARY")
    print(f"  Total unique keywords: {len(merged)}")
    print(f"  From Ads API only:     {ads_only}")
    print(f"  From Autocomplete only: {auto_only}")
    print(f"  From Gemini only:      {gemini_only}")
    print(f"  Multi-source overlap:  {multi}")
    print(f"  Ad group clusters:     {len(clusters)}")
    print(f"{'='*60}")


if __name__ == "__main__":
    main()

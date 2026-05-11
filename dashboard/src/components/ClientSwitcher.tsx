'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useActiveClient } from '@/contexts/ActiveClientContext';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import { IconChevronDown, IconBuilding } from '@tabler/icons-react';

interface ClientOption {
  client_id: string;
  name: string;
  vertical: string;
  status: string;
}

export function ClientSwitcher() {
  const { activeClientId, setActiveClient } = useActiveClient();
  const [clients, setClients] = useState<ClientOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const router = useRouter();

  useEffect(() => {
    fetch('/api/clients')
      .then((r) => r.json())
      .then((data: ClientOption[]) => {
        if (Array.isArray(data)) setClients(data);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  // Keyboard shortcut: Cmd+Shift+C
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key === 'c') {
        e.preventDefault();
        setPaletteOpen((o) => !o);
      }
    }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  const activeClient = clients.find((c) => c.client_id === activeClientId);
  const label = activeClient?.name ?? 'All Clients';

  function selectClient(id: string | null) {
    setActiveClient(id);
    setPaletteOpen(false);
    if (id) {
      router.push(`/clients/${id}`);
    }
  }

  if (loading) {
    return (
      <div className="h-8 w-32 animate-pulse rounded-md bg-muted" />
    );
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger className="inline-flex h-8 items-center gap-1.5 rounded-md px-2 text-sm font-medium hover:bg-accent hover:text-accent-foreground transition-colors">
          <IconBuilding size={14} className="text-muted-foreground" />
          <span className="max-w-[120px] truncate">{label}</span>
          <IconChevronDown size={12} className="text-muted-foreground" />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-56">
          <DropdownMenuItem
            onClick={() => selectClient(null)}
            className={!activeClientId ? 'font-medium' : ''}
          >
            All Clients
          </DropdownMenuItem>
          {clients.length > 0 && <DropdownMenuSeparator />}
          {clients.map((c) => (
            <DropdownMenuItem
              key={c.client_id}
              onClick={() => selectClient(c.client_id)}
              className={activeClientId === c.client_id ? 'font-medium' : ''}
            >
              <span className="truncate">{c.name}</span>
              <span className="ml-auto text-xs text-muted-foreground capitalize">{c.status}</span>
            </DropdownMenuItem>
          ))}
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={() => setPaletteOpen(true)} className="text-muted-foreground text-xs">
            Search clients
            <span className="ml-auto font-mono">⌘⇧C</span>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <CommandDialog open={paletteOpen} onOpenChange={setPaletteOpen} title="Switch Client">
        <CommandInput placeholder="Search clients..." />
        <CommandList>
          <CommandEmpty>No clients found.</CommandEmpty>
          <CommandGroup heading="Clients">
            <CommandItem onSelect={() => selectClient(null)}>
              All Clients
            </CommandItem>
            {clients.map((c) => (
              <CommandItem
                key={c.client_id}
                value={`switch to ${c.name}`}
                onSelect={() => selectClient(c.client_id)}
              >
                <IconBuilding size={14} className="text-muted-foreground" />
                <span>{c.name}</span>
                <span className="ml-auto text-xs text-muted-foreground capitalize">{c.status}</span>
              </CommandItem>
            ))}
          </CommandGroup>
        </CommandList>
      </CommandDialog>
    </>
  );
}

import { supabase } from './supabase';

// Menu items selected for a specific event, drawn from the org's experiences/menu
// catalog (see experiences.ts). Read access: anyone who can_access_event (management,
// assigned chef, or the client on the event). Write access: management only (RLS
// migration 011).
export type EventMenuItem = {
  id: string;
  eventId: string;
  menuItemId: string;
  name: string;
  quantity: number;
  priceAdjustment: number;
};

export async function fetchEventMenuItems(eventId: string): Promise<{
  data: EventMenuItem[];
  error: string | null;
}> {
  const { data, error } = await supabase
    .from('event_menu_items')
    .select('id, event_id, menu_item_id, quantity, price_adjustment, menu_items(name)')
    .eq('event_id', eventId);

  if (error) return { data: [], error: error.message };

  return {
    data: (data ?? []).map((r: any) => ({
      id: r.id,
      eventId: r.event_id,
      menuItemId: r.menu_item_id,
      name: r.menu_items?.name ?? 'Item',
      quantity: r.quantity,
      priceAdjustment: Number(r.price_adjustment) || 0,
    })),
    error: null,
  };
}

export async function addEventMenuItem(input: {
  eventId: string;
  menuItemId: string;
  quantity: number;
  priceAdjustment: number;
}): Promise<void> {
  const { error } = await supabase.from('event_menu_items').insert({
    event_id: input.eventId,
    menu_item_id: input.menuItemId,
    quantity: input.quantity,
    price_adjustment: input.priceAdjustment,
  });
  if (error) throw error;
}

export async function removeEventMenuItem(id: string): Promise<void> {
  const { error } = await supabase.from('event_menu_items').delete().eq('id', id);
  if (error) throw error;
}

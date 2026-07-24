import { Pressable, StyleSheet, Text, View } from 'react-native';
import { OrgRole, useAuth } from '@/contexts/auth-context';

// DEV ONLY. A small floating control that lets you preview the app through
// every user lens (visitor / client / chef / manager / admin / owner) without
// signing out and back in. It renders nothing in production builds.
const LENSES: { label: string; role: OrgRole }[] = [
  { label: 'Visitor', role: null },
  { label: 'Client', role: 'client' },
  { label: 'Chef', role: 'chef' },
  { label: 'Manager', role: 'manager' },
  { label: 'Admin', role: 'admin' },
  { label: 'Owner', role: 'owner' },
];

export function DevRoleSwitcher() {
  const { devRoleOverride, setDevRoleOverride, role } = useAuth();
  if (!__DEV__) return null;

  const activeRole = devRoleOverride ?? role;

  return (
    <View style={styles.wrap} pointerEvents="box-none">
      <View style={styles.bar}>
        <Text style={styles.title}>Preview as</Text>
        <View style={styles.chips}>
          {LENSES.map((lens) => {
            const selected = activeRole === lens.role;
            return (
              <Pressable
                key={lens.label}
                onPress={() => setDevRoleOverride(lens.role)}
                style={[styles.chip, selected && styles.chipActive]}
              >
                <Text style={[styles.chipText, selected && styles.chipTextActive]}>
                  {lens.label}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 24,
    alignItems: 'center',
    zIndex: 9999,
  },
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#22273F',
    borderRadius: 999,
    paddingVertical: 8,
    paddingHorizontal: 12,
    gap: 8,
    shadowColor: '#000',
    shadowOpacity: 0.25,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 8,
    flexWrap: 'wrap',
    maxWidth: '94%',
  },
  title: {
    color: '#F5EFE5',
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginRight: 2,
  },
  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  chip: {
    paddingVertical: 5,
    paddingHorizontal: 10,
    borderRadius: 999,
    backgroundColor: 'rgba(245,239,229,0.12)',
  },
  chipActive: {
    backgroundColor: '#CD7E56',
  },
  chipText: {
    color: '#F5EFE5',
    fontSize: 12,
    fontWeight: '600',
  },
  chipTextActive: {
    color: '#22273F',
  },
});

import EntityTable from '../../components/EntityTable';
import { listAuthorityLevels, createEntity, updateEntity, setEntityActive } from '../../lib/api/orgHierarchy';

const ROLE_TIER_OPTIONS = [
  { value: 'AREA_MANAGER', label: 'Area Manager' },
  { value: 'ZO', label: 'ZO' },
];

const CREATABLE_ROLE_OPTIONS = [
  { value: 'ZO', label: 'ZO' },
  { value: 'SUPERVISOR', label: 'Supervisor' },
  { value: 'SURVEYOR', label: 'Surveyor' },
  { value: 'RECTIFIER', label: 'Rectifier' },
];

// Point H: which roles a GM LWMC / Town Manager / AC / ZO can create is
// controlled here, not hardcoded — assign an authority level to a user
// (from their profile) and edit its creatable_roles any time. Defaults
// seeded in 0008_authority_levels.sql are just a starting point.
export default function AuthorityLevels() {
  return (
    <EntityTable
      title="Authority Levels"
      columns={[
        { key: 'name', label: 'Name' },
        { key: 'role_tier', label: 'Applies to' },
        { key: 'creatable_roles', label: 'Can create', render: (row) => (row.creatable_roles || []).join(', ') || '—' },
      ]}
      fields={[
        { key: 'name', label: 'Name (e.g. GM LWMC, Town Manager, AC)' },
        { key: 'role_tier', label: 'Applies to role tier', type: 'select', options: ROLE_TIER_OPTIONS, default: 'AREA_MANAGER' },
        { key: 'creatable_roles', label: 'Can create', type: 'multiselect', options: CREATABLE_ROLE_OPTIONS },
      ]}
      list={() => listAuthorityLevels()}
      onCreate={(fields) => createEntity('authority_levels', fields)}
      onUpdate={(id, fields) => updateEntity('authority_levels', id, fields)}
      onToggleActive={(id, val) => setEntityActive('authority_levels', id, val)}
    />
  );
}

import EntityTable from '../../components/EntityTable';
import { listDistricts, createEntity, updateEntity, setEntityActive } from '../../lib/api/orgHierarchy';

export default function Districts() {
  return (
    <EntityTable
      title="Districts"
      columns={[
        { key: 'name', label: 'Name' },
        { key: 'code', label: 'Code' },
      ]}
      fields={[
        { key: 'name', label: 'Name' },
        { key: 'code', label: 'Code' },
      ]}
      list={() => listDistricts()}
      onCreate={(fields) => createEntity('districts', fields)}
      onUpdate={(id, fields) => updateEntity('districts', id, fields)}
      onToggleActive={(id, val) => setEntityActive('districts', id, val)}
    />
  );
}

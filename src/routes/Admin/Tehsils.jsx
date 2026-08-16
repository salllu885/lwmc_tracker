import EntityTable from '../../components/EntityTable';
import { listTehsils, createEntity, updateEntity, setEntityActive } from '../../lib/api/orgHierarchy';

export default function Tehsils() {
  return (
    <EntityTable
      title="Tehsils"
      columns={[
        { key: 'name', label: 'Name' },
        { key: 'code', label: 'Code' },
      ]}
      fields={[
        { key: 'name', label: 'Name' },
        { key: 'code', label: 'Code' },
      ]}
      list={() => listTehsils()}
      onCreate={(fields) => createEntity('tehsils', fields)}
      onUpdate={(id, fields) => updateEntity('tehsils', id, fields)}
      onToggleActive={(id, val) => setEntityActive('tehsils', id, val)}
    />
  );
}

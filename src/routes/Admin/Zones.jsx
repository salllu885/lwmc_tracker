import { useEffect, useState } from 'react';
import EntityTable from '../../components/EntityTable';
import { listZones, listTehsils, createEntity, updateEntity, setEntityActive } from '../../lib/api/orgHierarchy';

export default function Zones() {
  const [tehsils, setTehsils] = useState([]);

  useEffect(() => {
    listTehsils().then(setTehsils);
  }, []);

  const tehsilName = (id) => tehsils.find((t) => t.id === id)?.name || id;

  return (
    <EntityTable
      title="Zones"
      columns={[
        { key: 'name', label: 'Name' },
        { key: 'tehsil_id', label: 'Tehsil', render: (r) => tehsilName(r.tehsil_id) },
      ]}
      fields={[
        { key: 'name', label: 'Name' },
        { key: 'tehsil_id', label: 'Tehsil', type: 'select', options: tehsils.map((t) => ({ value: t.id, label: t.name })) },
      ]}
      list={() => listZones()}
      onCreate={(fields) => createEntity('zones', fields)}
      onUpdate={(id, fields) => updateEntity('zones', id, fields)}
      onToggleActive={(id, val) => setEntityActive('zones', id, val)}
    />
  );
}

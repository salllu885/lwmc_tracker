import { useEffect, useState } from 'react';
import EntityTable from '../../components/EntityTable';
import { listUcs, listZones, createEntity, updateEntity, setEntityActive } from '../../lib/api/orgHierarchy';

export default function Ucs() {
  const [zones, setZones] = useState([]);

  useEffect(() => {
    listZones().then(setZones);
  }, []);

  const zoneName = (id) => zones.find((z) => z.id === id)?.name || id;

  // ucs.tehsil_id is derived from the chosen zone rather than asked for
  // directly, so the two can never end up inconsistent.
  function withTehsil(fields) {
    const zone = zones.find((z) => z.id === fields.zone_id);
    return { ...fields, tehsil_id: zone?.tehsil_id };
  }

  return (
    <EntityTable
      title="UCs"
      columns={[
        { key: 'name', label: 'Name' },
        { key: 'code', label: 'Code' },
        { key: 'zone_id', label: 'Zone', render: (r) => zoneName(r.zone_id) },
      ]}
      fields={[
        { key: 'name', label: 'Name' },
        { key: 'code', label: 'Code' },
        { key: 'zone_id', label: 'Zone', type: 'select', options: zones.map((z) => ({ value: z.id, label: z.name })) },
      ]}
      list={() => listUcs()}
      onCreate={(fields) => createEntity('ucs', withTehsil(fields))}
      onUpdate={(id, fields) => updateEntity('ucs', id, withTehsil(fields))}
      onToggleActive={(id, val) => setEntityActive('ucs', id, val)}
    />
  );
}

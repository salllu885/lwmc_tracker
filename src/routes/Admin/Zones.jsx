import { useEffect, useState } from 'react';
import EntityTable from '../../components/EntityTable';
import BoundaryLookupField from '../../components/BoundaryLookupField';
import { listZones, listTehsils, createEntity, updateEntity, setEntityActive } from '../../lib/api/orgHierarchy';
import { parseBoundary, serializeBoundary } from '../../lib/boundary';

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
        {
          key: 'boundary',
          label: 'Boundary (GeoJSON, optional)',
          type: 'textarea',
          hint: 'Shown as an outline on the Map view. Paste a GeoJSON Polygon/MultiPolygon, or look one up below.',
          parse: parseBoundary,
          serialize: serializeBoundary,
          actions: (form, setForm) => (
            <BoundaryLookupField
              defaultQuery={form.name ? `${form.name}, Punjab, Pakistan` : ''}
              onFound={(text) => setForm((s) => ({ ...s, boundary: text }))}
            />
          ),
        },
      ]}
      list={() => listZones()}
      onCreate={(fields) => createEntity('zones', fields)}
      onUpdate={(id, fields) => updateEntity('zones', id, fields)}
      onToggleActive={(id, val) => setEntityActive('zones', id, val)}
    />
  );
}

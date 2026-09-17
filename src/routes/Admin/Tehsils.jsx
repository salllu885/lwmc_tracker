import { useEffect, useState } from 'react';
import EntityTable from '../../components/EntityTable';
import BoundaryLookupField from '../../components/BoundaryLookupField';
import { listTehsils, listDistricts, createEntity, updateEntity, setEntityActive } from '../../lib/api/orgHierarchy';
import { parseBoundary, serializeBoundary } from '../../lib/boundary';

const AREA_TYPES = [
  { value: 'TEHSIL', label: 'Tehsil' },
  { value: 'TOWN', label: 'Town' },
];

export default function Tehsils() {
  const [districts, setDistricts] = useState([]);

  useEffect(() => {
    listDistricts().then(setDistricts);
  }, []);

  const districtName = (id) => districts.find((d) => d.id === id)?.name || id;
  const areaTypeLabel = (v) => AREA_TYPES.find((t) => t.value === v)?.label || v;

  return (
    <EntityTable
      title="Tehsils & Towns"
      columns={[
        { key: 'name', label: 'Name' },
        { key: 'code', label: 'Code' },
        { key: 'area_type', label: 'Type', render: (r) => areaTypeLabel(r.area_type) },
        { key: 'district_id', label: 'District', render: (r) => districtName(r.district_id) },
      ]}
      fields={[
        { key: 'name', label: 'Name' },
        { key: 'code', label: 'Code' },
        { key: 'area_type', label: 'Type', type: 'select', options: AREA_TYPES, default: 'TEHSIL' },
        { key: 'district_id', label: 'District', type: 'select', options: districts.map((d) => ({ value: d.id, label: d.name })) },
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
      list={() => listTehsils()}
      onCreate={(fields) => createEntity('tehsils', fields)}
      onUpdate={(id, fields) => updateEntity('tehsils', id, fields)}
      onToggleActive={(id, val) => setEntityActive('tehsils', id, val)}
    />
  );
}

import EntityTable from '../../components/EntityTable';
import { listIssueTypes, createEntity, updateEntity, setEntityActive } from '../../lib/api/orgHierarchy';

export default function IssueTypes() {
  return (
    <EntityTable
      title="Issue Types"
      columns={[
        { key: 'name', label: 'Name' },
        { key: 'description', label: 'Description' },
      ]}
      fields={[
        { key: 'name', label: 'Name' },
        { key: 'description', label: 'Description' },
        { key: 'color', label: 'Color (hex)', default: '#475569' },
      ]}
      list={() => listIssueTypes()}
      onCreate={(fields) => createEntity('issue_types', fields)}
      onUpdate={(id, fields) => updateEntity('issue_types', id, fields)}
      onToggleActive={(id, val) => setEntityActive('issue_types', id, val)}
    />
  );
}

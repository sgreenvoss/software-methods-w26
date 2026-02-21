export default function GroupHeatmap({ groupId }) {
  const [viewMode, setViewMode] = useState('B1');
  const [blocks, setBlocks] = useState([]);

  // This is the ONLY place the toggle exists
  return (
    <div className="poc-container">
      <div className="poc-header">
        <h3>Group {groupId} Availability</h3>
        <select value={viewMode} onChange={e => setViewMode(e.target.value)}>
          <option value="B1">Strict (B1)</option>
          <option value="B2">Flexible (B2)</option>
          <option value="B3">Lax (B3)</option>
        </select>
      </div>
      
      <div className="poc-grid">
        {/* Simple mapping of blocks into 15-min rows */}
        {blocks.map(block => (
          <div key={block.startMs} className="poc-row">
            <span>{new Date(block.startMs).toLocaleTimeString()}</span>
            <strong>{Math.round(block.views[viewMode] * 100)}% Available</strong>
          </div>
        ))}
      </div>
    </div>
  );
}
const AvailBlock = ({ data, viewMode }) => {
  const availability = data.views[viewMode];
  
  return (
    <div className="poc-block" style={{ border: '1px solid #ccc', padding: '2px' }}>
      {/* The literal proof: 0.5 -> "50%" */}
      {Math.round(availability * 100)}%
    </div>
  );
};
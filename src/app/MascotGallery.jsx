import * as ALL_MASCOTS from './Mascots'

/** Dev-only: every illustration side by side, to keep the family consistent. */
function MascotGallery() {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 16, padding: 16, background: '#f4f6fa' }}>
      {Object.entries(ALL_MASCOTS).map(([name, Art]) => (
        <figure key={name} style={{ margin: 0, background: '#fff', borderRadius: 16, padding: 12, textAlign: 'center' }}>
          <Art style={{ width: '100%', height: 'auto' }} />
          <figcaption style={{ fontSize: 12, color: '#456' }}>{name}</figcaption>
        </figure>
      ))}
    </div>
  )
}

export default MascotGallery

/** Otvoren → Dodijeljen → Završen across the top of the job, like Airtasker's OPEN / ASSIGNED / COMPLETED. */
function JobStatusTrack({ status, expired, hasWorker }) {
  if (status === 'cancelled' || expired) {
    return <ol className="job-status-track"><li className="is-current is-stopped">{expired ? 'Rok prošao' : 'Otkazan'}</li></ol>
  }
  const step = status === 'completed' ? 2 : (status === 'assigned' || hasWorker) ? 1 : 0
  const steps = ['Otvoren', 'Dodijeljen', 'Završen']
  return (
    <ol className="job-status-track" aria-label="Stanje posla">
      {steps.map((label, index) => (
        <li key={label} className={`${index < step ? 'is-done' : ''} ${index === step ? `is-current ${index === 1 ? 'is-assigned' : ''}` : ''}`} aria-current={index === step ? 'step' : undefined}>{label}</li>
      ))}
    </ol>
  )
}

export default JobStatusTrack

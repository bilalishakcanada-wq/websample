import { useCountUp } from '../hooks/useCountUp'

/** <CountUp value={1234.5} format={(n) => …} /> — renders a number that animates to its value. */
function CountUp({ value, format = (n) => Math.round(n).toLocaleString('bs-BA'), duration, className = '' }) {
  const shown = useCountUp(value, { duration })
  return <span className={`count-up ${className}`.trim()}>{format(shown)}</span>
}

export default CountUp

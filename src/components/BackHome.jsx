import { Link } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'

function BackHome({ label = 'Početna' }) {
  return (
    <Link to="/" className="back-home-link">
      <ArrowLeft size={16} /> {label}
    </Link>
  )
}

export default BackHome

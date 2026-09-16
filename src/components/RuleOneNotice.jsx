import { Link } from 'react-router-dom'
import { ShieldBan } from 'lucide-react'
import { RULE_ONE_TEXT } from '../utils/moderation'

/** Small reminder shown next to any field people write into. */
function RuleOneNotice({ compact = false }) {
  return (
    <div className={`rule-one-notice ${compact ? 'compact' : ''}`}>
      <ShieldBan size={compact ? 14 : 16} />
      <span>
        {compact ? 'Pravilo #1: bez brojeva, emaila i društvenih mreža.' : RULE_ONE_TEXT}{' '}
        <Link to="/pravila-zajednice#pravilo-1">Detalji</Link>
      </span>
    </div>
  )
}

export default RuleOneNotice

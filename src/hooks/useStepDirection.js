import { useState } from 'react'

/** 'forward' or 'back': which way the last step change went, so a wizard can slide the right way. */
export function useStepDirection(step) {
  const [seen, setSeen] = useState({ step, dir: 'forward' })
  if (seen.step === step) return seen.dir
  const dir = step < seen.step ? 'back' : 'forward'
  setSeen({ step, dir })
  return dir
}

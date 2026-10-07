import LocationTypeahead from './LocationTypeahead'

/** The location field on forms: any town, village or town quarter in BiH (see LocationTypeahead). */
function CityField({ label = 'Mjesto (naselje ili grad)', ...props }) {
  return <LocationTypeahead label={label} {...props} />
}

export default CityField

import { useEffect, useState } from 'react'
import { MapPin } from 'lucide-react'
import { featuredCities } from '../data/featuredCities'

function CitySlideshow({ onSelectCity }) {
  const [index, setIndex] = useState(0)

  useEffect(() => {
    const timer = setInterval(() => setIndex((current) => (current + 1) % featuredCities.length), 4000)
    return () => clearInterval(timer)
  }, [])

  return (
    <div className="city-slideshow">
      {featuredCities.map((city, i) => (
        <button
          key={city.id}
          type="button"
          className={`city-slide ${i === index ? 'active' : ''}`}
          style={{ backgroundImage: `url(${city.image})` }}
          onClick={() => onSelectCity(city.name)}
          aria-label={`Pretraži poslove u gradu ${city.name}`}
        >
          {i === index && (
            <span className="city-slide-label"><MapPin size={14} /> {city.name}</span>
          )}
        </button>
      ))}
      <div className="city-slideshow-dots">
        {featuredCities.map((city, i) => (
          <button key={city.id} type="button" className={`city-slideshow-dot ${i === index ? 'active' : ''}`} onClick={() => setIndex(i)} aria-label={city.name} />
        ))}
      </div>
    </div>
  )
}

export default CitySlideshow

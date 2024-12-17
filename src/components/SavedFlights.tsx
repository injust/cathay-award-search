import { JSX } from 'preact'

import { X } from './Icons.tsx'
import { lang } from '../localization.ts'
import { FlightAvailability } from '../types.ts'
import { queryStringToQuery, queryToQueryString } from '../utils.ts'

interface SavedFlightsProps {
  savedFlights: Map<string, FlightAvailability>
}

export const SavedFlights = ({ savedFlights }: SavedFlightsProps): JSX.Element => {
  const sortedFlights = Array.from(savedFlights, ([flightKey, avail]) => ({
    flightKey,
    query: queryStringToQuery(flightKey), // TODO: Should make something to parse `flightKey`
    leg1: flightKey.split('_')[1] ?? '',
    stop: flightKey.split('_')[2] ?? '',
    leg2: flightKey.split('_')[3] ?? '',
    avail
  })).sort((a, b) => +a.query.date - +b.query.date)

  return (
    <div class='saved_flights'>
      {sortedFlights.map(({ flightKey, query, leg1, stop, leg2, avail }) => {
        const queryString = queryToQueryString(query)

        return (
          <div key={flightKey} class='saved_flight' data-query={queryString}>
            <label>
              <input type='checkbox' data-query={queryString} />
              <span>
                <span class='date'>{query.date.format('YYYY-MM-DD')}</span>
                <span class='route'>{query.from}-{stop}{stop !== '' && '-'}{query.to}</span>
                <span class='flights'>
                  {leg1}{leg2 !== '' && ' + '}{leg2}
                  <span class='avail'>
                    {avail.F > 0 && <span class='f'>F {avail.F}</span>}
                    {avail.J > 0 && <span class='j'>J {avail.J}</span>}
                    {avail.PY > 0 && <span class='py'>PY {avail.PY}</span>}
                    {avail.Y > 0 && <span class='y'>Y {avail.Y}</span>}
                  </span>
                </span>
              </span>
            </label>
            <a href='javascript:void 0' class='saved_search' data-book data-query={queryString}>{lang.search} &raquo;</a>
            <span class='leg' />
            <a href='javascript:void 0' class='saved_remove' data-flight-key={flightKey}><X className='saved_delete' /></a>
          </div>
        )
      })}
    </div>
  )
}

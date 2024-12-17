import { xSvg } from '../images/svg.tsx'
import { lang } from '../localization.ts'
import { FlightAvailability } from '../types.ts'
import { log, queryStringToQuery, queryToQueryString, valueSet } from '../utils.ts'
import { JSX } from 'preact'
import { Signal, batch, computed, useSignalEffect } from '@preact/signals'

interface SavedFlightsProps {
  savedFlights: Signal<Map<string, FlightAvailability>>
}

export const SavedFlights = ({ savedFlights }: SavedFlightsProps): JSX.Element => {
  const sortedFlights = computed(() => Array.from(savedFlights.value, ([flightKey, avail]) => ({
    flightKey,
    query: queryStringToQuery(flightKey), // TODO: Should make something to parse `flightKey`
    leg1: flightKey.split('_')[1] ?? '',
    stop: flightKey.split('_')[2] ?? '',
    leg2: flightKey.split('_')[3] ?? '',
    avail
  })).sort((a, b) => +a.query.date - +b.query.date)
  )

  useSignalEffect(() => {
    (async () => {
      batch(() => {
        for (const flightKey of savedFlights.value.keys()) {
          const query = queryStringToQuery(flightKey) // TODO: Should make something to parse `flightKey`
          const savedDate = query.date.toDate()
          const now = new Date()
          if (savedDate <= now) savedFlights.value.delete(flightKey)
        }
      })

      await valueSet('saved_flights', Object.fromEntries(savedFlights.value))
    })().catch(log)
  })

  return (
    <div class='saved_flights'>
      {sortedFlights.value.map(({ flightKey, query, leg1, stop, leg2, avail }) => {
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
            <a href='javascript:void 0' class='saved_book' data-book data-query={queryString}>{lang.query} &raquo;</a>
            <span class='leg' />
            <a href='javascript:void 0' class='saved_remove' data-flight-key={flightKey}>{xSvg('saved_delete')}</a>
          </div>
        )
      })}
    </div>
  )
}

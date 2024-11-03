import { FunctionComponent } from 'preact'

import { Query } from '../types.ts'

interface FlightResultsRowProps {
  query: Query
}

export const FlightResultsRow: FunctionComponent<FlightResultsRowProps> = ({ query }) => {
  return (
    <tr data-date={query.date.format('YYYYMMDD')}>
      <td class='bulk_date'>
        <div>{query.date.format('dddd')}</div>
        <div>{query.date.format('YYYY-MM-DD')}</div>
      </td>
      <td class='bulk_flights' />
    </tr>
  )
}

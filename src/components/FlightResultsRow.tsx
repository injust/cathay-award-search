import type { JSX } from 'preact'

import type { Query } from '../types.ts'

interface FlightResultsRowProps {
    query: Query
}

export const FlightResultsRow = ({ query }: FlightResultsRowProps): JSX.Element => {
    return (
        <tr data-date={query.date.format('YYYYMMDD')}>
            <td class="bulk_date">
                <div>{query.date.format('dddd')}</div>
                <div>{query.date.format('YYYY-MM-DD')}</div>
            </td>
            <td class="bulk_flights" />
        </tr>
    )
}

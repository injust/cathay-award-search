import { JSX } from 'preact'

import { X } from './Icons.tsx'
import { lang } from '../localization.ts'
import { queryStringToQuery, queryToQueryString } from '../utils.ts'

interface SavedQueriesProps {
  savedQueries: Set<string>
}

export const SavedQueries = ({ savedQueries }: SavedQueriesProps): JSX.Element => {
  const sortedQueries = Array.from(savedQueries, queryStringToQuery).sort((a, b) => +a.date - +b.date)

  return (
    <div class='saved_queries'>
      {sortedQueries.map(query => {
        const queryString = queryToQueryString(query)

        return (
          <div key={queryString} class='saved_query' data-query={queryString}>
            <label><input type='checkbox' data-query={queryString} />{query.date.format('YYYY-MM-DD')} {query.from}-{query.to}</label>
            <a href='javascript:void 0' class='saved_search' data-book data-query={queryString}>{lang.search} &raquo;</a>
            <span class='leg' />
            <a href='javascript:void 0' class='saved_remove' data-query={queryString}><X className='saved_delete' /></a>
          </div>
        )
      })}
    </div>
  )
}

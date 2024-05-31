import { X } from './Icons.tsx'
import { lang } from '../localization.ts'
import { queryStringToQuery, queryToQueryString } from '../utils.ts'
import { FunctionComponent } from 'preact'

interface SavedQueriesProps {
  savedQueries: Set<string>
}

export const SavedQueries: FunctionComponent<SavedQueriesProps> = ({ savedQueries }) => {
  const sortedQueries = Array.from(savedQueries, queryStringToQuery).sort((a, b) => +a.date - +b.date)

  return (
    <>
      {sortedQueries.map(query => {
        const queryString = queryToQueryString(query)

        return (
          <div key={queryString} class='saved_query' data-query={queryString}>
            <label><input type='checkbox' data-query={queryString} />{query.date.format('YYYY-MM-DD')} {query.from}-{query.to}</label>
            <a href='javascript:void 0' class='saved_book' data-book data-query={queryString}>{lang.query} &raquo;</a>
            <span class='leg' />
            <a href='javascript:void 0' class='saved_remove' data-query={queryString}><X className='saved_delete' /></a>
          </div>
        )
      })}
    </>
  )
}

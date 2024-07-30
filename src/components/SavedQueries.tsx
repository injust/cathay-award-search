import { xSvg } from '../images/svg.tsx'
import { lang } from '../localization.ts'
import { log, queryStringToQuery, queryToQueryString, valueSet } from '../utils.ts'
import { FunctionComponent } from 'preact'
import { Signal, batch, computed, useSignalEffect } from '@preact/signals'

interface SavedQueriesProps {
  savedQueries: Signal<Set<string>>
}

export const SavedQueries: FunctionComponent<SavedQueriesProps> = ({ savedQueries }) => {
  const sortedQueries = computed(() => Array.from(savedQueries.value, queryStringToQuery).sort((a, b) => +a.date - +b.date))

  useSignalEffect(() => {
    (async () => {
      batch(() => {
        for (const queryString of savedQueries.value) {
          const query = queryStringToQuery(queryString)
          const savedDate = query.date.toDate()
          const now = new Date()
          if (savedDate <= now) savedQueries.value.delete(queryString)
        }
      })

      await valueSet('saved_queries', Array.from(savedQueries.value))
    })().catch(log)
  })

  return (
    <div class='saved_queries'>
      {sortedQueries.value.map(query => {
        const queryString = queryToQueryString(query)

        return (
          <div key={queryString} class='saved_query' data-query={queryString}>
            <label><input type='checkbox' data-query={queryString} />{query.date.format('YYYY-MM-DD')} {query.from}-{query.to}</label>
            <a href='javascript:void 0' class='saved_book' data-book data-query={queryString}>{lang.query} &raquo;</a>
            <span class='leg' />
            <a href='javascript:void 0' class='saved_remove' data-query={queryString}>{xSvg('saved_delete')}</a>
          </div>
        )
      })}
    </div>
  )
}

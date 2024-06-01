import { Chevron, Heart } from './Icons.tsx'
import { FlightAvailability, PageBomFlight } from '../types.ts'
import { formatFlightDuration, formatFlightTime, parseCabinStatus } from '../utils.ts'
import classNames from 'classnames'
import { FunctionComponent, VNode } from 'preact'

interface FlightResultProps {
  flight: PageBomFlight
  flightKey: string
  savedFlights: Map<string, FlightAvailability>
  staticFilesPath: string
}

export const FlightResult: FunctionComponent<FlightResultProps> = ({ flight, flightKey, savedFlights, staticFilesPath }) => {
  const numF = Math.min(...flight.segments.map(segment => parseCabinStatus(segment.cabins?.F?.status)))
  const numJ = Math.min(...flight.segments.map(segment => parseCabinStatus(segment.cabins?.B?.status)))
  const numPY = Math.min(...flight.segments.map(segment => parseCabinStatus(segment.cabins?.N?.status)))
  const numY = Math.min(...flight.segments.map(segment => parseCabinStatus(segment.cabins?.E?.status) + parseCabinStatus(segment.cabins?.R?.status)))

  const available: VNode[] = []
  if (numF > 0) available.push(<span class='bulk_cabin bulk_f'>F <b>{numF}</b></span>)
  if (numJ > 0) available.push(<span class='bulk_cabin bulk_j'>J <b>{numJ}</b></span>)
  if (numPY > 0) available.push(<span class='bulk_cabin bulk_p'>PY <b>{numPY}</b></span>)
  if (numY > 0) available.push(<span class='bulk_cabin bulk_y'>Y <b>{numY}</b></span>)
  if (available.length === 0) return <></>

  const duration = formatFlightDuration(flight.duration)

  const leg1Airline = flight.segments[0].flightIdentifier.marketingAirline
  const leg1FlightNum = flight.segments[0].flightIdentifier.flightNumber
  const leg1DepTime = formatFlightTime(flight.segments[0].flightIdentifier.originDate)
  const leg1ArrTime = formatFlightTime(flight.segments[0].destinationDate)
  const leg1Origin = flight.segments[0].originLocation
  const leg1Dest = flight.segments[0].destinationLocation

  if (flight.segments.length === 1) {
    return (
      <div class='flight_wrapper'>
        <div class={classNames('flight_item', 'direct', { saved: savedFlights.has(flightKey), f: numF > 0, j: numJ > 0, py: numPY > 0, y: numY > 0 })} data-flight-key={flightKey} data-flight-avail={`${numF}_${numJ}_${numPY}_${numY}`}>
          <img src={`https://book.cathaypacific.com${staticFilesPath}common/skin/img/airlines/logo-${leg1Airline.toLowerCase()}.png`} />
          <span class='flight_num'>{leg1Airline}{leg1FlightNum}</span>
          {...available}
          <span class='chevron'><Chevron /></span>
          <span class='flight_save'><Heart className='heart_save' /></span>
        </div>
        <div class='flight_info'>
          <span class='info_flight'>{leg1Airline}{leg1FlightNum} ({leg1Origin.slice(-3)} ✈ {leg1Dest.slice(-3)})</span>
          <span class='info_dept'><span>Departs:</span> {leg1DepTime}</span>
          <span class='info_arr'><span>Arrives:</span> {leg1ArrTime}</span>
          <span class='info_duration'><span>Total Flight Duration:</span> {duration}</span>
        </div>
      </div>
    )
  } else {
    const transitTime = formatFlightDuration(flight.segments[1].flightIdentifier.originDate - flight.segments[0].destinationDate)
    const transitAirportCode = /^[A-Z]{3}:([A-Z:]{3,7}):[A-Z]{3}_/g.exec(flight.flightIdString)[1].replace(':', ' / ')

    const leg2Airline = flight.segments[1].flightIdentifier.marketingAirline
    const leg2FlightNum = flight.segments[1].flightIdentifier.flightNumber
    const leg2DepTime = formatFlightTime(flight.segments[1].flightIdentifier.originDate)
    const leg2ArrTime = formatFlightTime(flight.segments[1].destinationDate)
    const leg2Origin = flight.segments[1].originLocation
    const leg2Dest = flight.segments[1].destinationLocation

    return (
      <div class='flight_wrapper'>
        <div class={classNames('flight_item', { saved: savedFlights.has(flightKey), f: numF > 0, j: numJ > 0, py: numPY > 0, y: numY > 0 })} data-flight-key={flightKey} data-flight-avail={`${numF}_${numJ}_${numPY}_${numY}`}>
          <img src={`https://book.cathaypacific.com${staticFilesPath}common/skin/img/airlines/logo-${leg1Airline.toLowerCase()}.png`} />
          <span class='flight_num'>{leg1Airline}{leg1FlightNum}
            <span class='stopover'>{transitAirportCode}</span>
            {leg2Airline}{leg2FlightNum}
          </span>
          {...available}
          <span class='chevron'><Chevron /></span>
          <span class='flight_save'><Heart className='heart_save' /></span>
        </div>
        <div class='flight_info'>
          <span class='info_flight'>{leg1Airline}{leg1FlightNum} ({leg1Origin.slice(-3)} ✈ {leg1Dest.slice(-3)})</span>
          <span class='info_dept'><span>Departs:</span> {leg1DepTime}</span>
          <span class='info_arr'><span>Arrives:</span> {leg1ArrTime}</span>
          <span class='info_transit'><span>Transit Time:</span> {transitTime}</span>
          <span class='info_flight'>{leg2Airline}{leg2FlightNum} ({leg2Origin.slice(-3)} ✈ {leg2Dest.slice(-3)})</span>
          <span class='info_dept'><span>Departs:</span> {leg2DepTime}</span>
          <span class='info_arr'><span>Arrives:</span> {leg2ArrTime}</span>
          <span class='info_duration'><span>Total Flight Duration:</span> {duration}</span>
        </div>
      </div>
    )
  }
}

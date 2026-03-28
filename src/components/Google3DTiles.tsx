import { Vector3 } from 'three'
import {
  TilesRenderer,
  TilesPlugin,
  TilesAttributionOverlay,
} from '3d-tiles-renderer/r3f'
import { GoogleCloudAuthPlugin } from '3d-tiles-renderer/plugins'
import { WGS84_ELLIPSOID } from '3d-tiles-renderer'

const DEG2RAD = Math.PI / 180

type Props = {
  apiKey: string
}

/**
 * Renders Google Photorealistic 3D Tiles.
 * Camera control is handled externally by EcefWalkNavigation.
 */
export function Google3DTiles({ apiKey }: Props) {
  return (
    <TilesRenderer>
      <TilesPlugin
        plugin={GoogleCloudAuthPlugin}
        args={[{ apiToken: apiKey }]}
      />
      <TilesAttributionOverlay />
    </TilesRenderer>
  )
}

/**
 * Compute initial camera position in ECEF using WGS84 ellipsoid.
 * Used for Canvas camera prop initialization.
 */
export function getECEFPosition(
  lat: number,
  lng: number,
  altitude: number,
): [number, number, number] {
  const latRad = lat * DEG2RAD
  const lonRad = lng * DEG2RAD
  const pos = new Vector3()
  WGS84_ELLIPSOID.getCartographicToPosition(latRad, lonRad, altitude, pos)
  return [pos.x, pos.y, pos.z]
}

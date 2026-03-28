export type Vec3 = [number, number, number]

export type Hotspot = {
  id: string
  position: Vec3
  title: string
  description: string
  imageUrl?: string
}

export type GuidedStep = {
  id: string
  cameraPosition: Vec3
  lookAt: Vec3
  label: string
  hotspotId?: string
}

/** One GLB layer; URLs may be site-local or remote */
export type GltfLayer = {
  url: string
  scale?: number
  position?: Vec3
}

export type SceneModel = {
  rootPosition?: Vec3
  layers: GltfLayer[]
}

export type EnvironmentConfig = {
  /** drei Environment preset: 'city' | 'sunset' | 'dawn' | 'park' | etc. */
  preset: 'apartment' | 'city' | 'dawn' | 'forest' | 'lobby' | 'night' | 'park' | 'studio' | 'sunset' | 'warehouse'
  /** Background blur 0-1 */
  backgroundBlurriness?: number
  backgroundIntensity?: number
  /** Use ground-projected environment */
  ground?: { radius?: number; height?: number; scale?: number }
  /** Sun position for Sky fallback [x, y, z] */
  sunPosition?: Vec3
  /** Water plane at given Y level */
  waterY?: number
  /** Ground color for areas below the model */
  groundColor?: string
}

/** A point of interest with geolocation for Google 3D Tiles scenes */
export type GeoPOI = {
  id: string
  title: string
  /** Narration text (2-3 sentences, read aloud by TTS) */
  narration: string
  /** Where the marker floats in the scene */
  markerLat: number
  markerLng: number
  markerAlt: number
  /** Camera viewpoint when visiting this POI */
  viewLat: number
  viewLng: number
  viewAlt: number
  viewHeading: number
  viewPitch: number
}

export type SceneConfig = {
  id: string
  title: string
  tagline: string
  description: string
  assetNote: string
  preview: {
    gradient: string
    image?: string
  }
  model: SceneModel
  /** First-person walk speed (units/sec) when using walk navigation */
  walkSpeed?: number
  /** Scene-specific environment/background config */
  environment?: EnvironmentConfig
  /** Real-world geolocation for Google 3D Tiles */
  geolocation?: {
    lat: number
    lng: number
    /** Altitude in meters above sea level */
    altitude?: number
    /** Heading/yaw in degrees (0 = north) */
    heading?: number
    /** Pitch in degrees (0 = horizontal, negative = look down) */
    pitch?: number
  }
  initial: {
    cameraPosition: Vec3
    lookAt: Vec3
  }
  /** First-person walk-mode start: camera at human eye-level looking forward */
  walkStart?: {
    cameraPosition: Vec3
    lookAt: Vec3
  }
  /** Geo-located points of interest for Google 3D Tiles mode */
  geoPOIs?: GeoPOI[]
  hotspots: Hotspot[]
  guidedPath: GuidedStep[]
}

/**
 * Sketchfab CC BY 4.0 glTF exports -- see each folder's license.txt for credit text.
 */
export const SCENES: SceneConfig[] = [
  {
    id: 'statue-of-liberty-ny',
    title: 'Statue of Liberty',
    tagline: 'Liberty Island, New York Harbor',
    description:
      'Standing 93 meters tall on Liberty Island, the Statue of Liberty has welcomed millions to New York Harbor since 1886. Designed by Frédéric Auguste Bartholdi and engineered by Gustave Eiffel, this iconic copper monument is a universal symbol of freedom and democracy, and a UNESCO World Heritage Site.',
    assetNote:
      'CC BY 4.0 . "Statue of Liberty, New York, NY, USA" by Brian Trepanier (Sketchfab / CMBC).',
    preview: {
      gradient:
        'linear-gradient(155deg, #0f172a 0%, #1d4ed8 38%, #bae6fd 100%)',
      image:
        'https://www.historyhit.com/app/uploads/bis-images/5150130/Statue-of-Liberty-e1632495792514-788x537.jpg',
    },
    walkSpeed: 60,
    environment: {
      preset: 'city',
      backgroundBlurriness: 0.3,
      backgroundIntensity: 0.8,
      sunPosition: [100, 60, 50],
      waterY: -30,
      ground: { radius: 600, height: 20, scale: 300 },
    },
    geolocation: {
      lat: 40.688286,
      lng: -74.042674,
      altitude: 10,
      heading: -38.9,
      pitch: -1,
    },
    model: {
      rootPosition: [0, 0, 0],
      layers: [{ url: '/models/statue-of-liberty/scene.gltf', scale: 1 }],
    },
    initial: {
      cameraPosition: [58, 32, 58],
      lookAt: [4, 4, 0],
    },
    walkStart: {
      cameraPosition: [32, 2, 32],
      lookAt: [0, 0, 0],
    },
    // Statue of Liberty: camera at (40.688286, -74.042674, alt 10, heading -38.9°)
    // Camera looks northwest toward statue. Ground WGS84 ≈ 10m.
    // KEY: viewAlt MUST be 50+ to stay well above 3D tile terrain.
    // Markers spread across the view: statue (left), island center, dock (right).
    geoPOIs: [
      {
        // Marker ON the statue — visible left side of initial view
        // View: southeast of statue, high up, looking NW at the torch
        id: 'sol-torch',
        title: 'Torch & Crown',
        narration: 'The torch and crown of Lady Liberty stand 93 meters above the harbor. The torch, gilded with 24-karat gold leaf, has been a beacon of hope for millions of immigrants arriving at Ellis Island since 1886. The crown contains 25 observation windows and 7 rays representing the seven continents and oceans of the world.',
        markerLat: 40.6892,
        markerLng: -74.0445,
        markerAlt: 55,
        viewLat: 40.6886,
        viewLng: -74.0438,
        viewAlt: 65,
        viewHeading: -40,
        viewPitch: 10,
      },
      {
        // Marker on the island center/south — visible center of initial view
        // View: south of island, elevated, looking north at pedestal + statue
        id: 'sol-pedestal',
        title: 'Star-Shaped Fort',
        narration: 'The statue stands upon the 11-pointed star walls of Fort Wood, built between 1808 and 1811 to defend New York Harbor. The pedestal rises 47 meters on top of this historic fortress, constructed with 27,000 tons of concrete. This ingenious design merges American military architecture with French neoclassical traditions.',
        markerLat: 40.6888,
        markerLng: -74.0440,
        markerAlt: 10,
        viewLat: 40.6878,
        viewLng: -74.0440,
        viewAlt: 55,
        viewHeading: 0,
        viewPitch: -8,
      },
    ],
    hotspots: [
      {
        id: 'torch',
        position: [2, 14, 1],
        title: 'Torch & flame',
        description:
          'The gilded flame replaced earlier designs; it symbolizes enlightenment. The original torch was swapped for a copper reconstruction in the 1980s restoration.',
      },
      {
        id: 'tablet',
        position: [10, 6, 5],
        title: 'July IV MDCCLXXVI',
        description:
          'The tablet evokes a law tablet, inscribed with independence in Roman numerals--linking the figure to republican ideals rather than a crowned monarch.',
      },
      {
        id: 'robe',
        position: [0, -4, 6],
        title: 'Neoclassical drapery',
        description:
          'Flowing robes and contrapposto stance borrow the language of Greek victory goddesses, translated into 19th-century Beaux-Arts engineering.',
      },
      {
        id: 'pedestal',
        position: [0, -28, 0],
        title: 'Pedestal & fort',
        description:
          'The star-shaped base adapts the former Fort Wood; its mass anchors the statue against wind loads and invites a climb through museum levels inside.',
      },
    ],
    guidedPath: [
      {
        id: 'sl1',
        label: 'Harbor approach',
        cameraPosition: [72, 40, 72],
        lookAt: [4, 2, 0],
      },
      {
        id: 'sl2',
        label: 'Monument scale',
        cameraPosition: [32, 16, 36],
        lookAt: [4, 8, 2],
        hotspotId: 'tablet',
      },
      {
        id: 'sl3',
        label: 'Crown & torch',
        cameraPosition: [18, 22, 22],
        lookAt: [2, 14, 1],
        hotspotId: 'torch',
      },
      {
        id: 'sl4',
        label: 'Pedestal mass',
        cameraPosition: [28, -8, 32],
        lookAt: [0, -26, 0],
        hotspotId: 'pedestal',
      },
    ],
  },
  {
    id: 'colosseum-rome-italy',
    title: 'Colosseum',
    tagline: 'Flavian Amphitheatre, Rome',
    description:
      'Built between 70–80 AD under emperors Vespasian and Titus, the Colosseum once held up to 50,000 spectators for gladiatorial contests and public spectacles. This iconic symbol of Imperial Rome is the largest ancient amphitheatre ever built, and remains one of the most visited landmarks in the world.',
    assetNote:
      'CC BY 4.0 . "Colosseum, Rome, Italy" by Brian Trepanier (Sketchfab / CMBC).',
    preview: {
      gradient:
        'linear-gradient(160deg, #292524 0%, #b45309 42%, #fcd34d 100%)',
      image:
        'https://images.unsplash.com/photo-1552832230-c0197dd311b5?w=800&q=80&auto=format',
    },
    walkSpeed: 60,
    environment: {
      preset: 'sunset',
      backgroundBlurriness: 0.35,
      backgroundIntensity: 0.7,
      sunPosition: [80, 40, 60],
      groundColor: '#8b7355',
      ground: { radius: 500, height: 15, scale: 250 },
    },
    geolocation: {
      lat: 41.888466,
      lng: 12.490298,
      altitude: 139.2,
      heading: 39.8,
      pitch: -15.5,
    },
    model: {
      rootPosition: [0, 0, 0],
      layers: [{ url: '/models/colosseum-rome-italy/scene.gltf', scale: 1 }],
    },
    initial: {
      cameraPosition: [26, 14, 22],
      lookAt: [-4, 1, 0.9],
    },
    walkStart: {
      cameraPosition: [-6.7, 0.6, 17.2],
      lookAt: [-6.7, 0.6, 0],
    },
    // Colosseum: camera at (41.888466, 12.490298, alt 139.2, heading 39.8°, pitch -15.5°)
    // Camera looks NE and slightly down. Ground WGS84 ≈ 139m.
    // KEY: viewAlt MUST be 180+ to stay well above 3D tile terrain (~160m actual).
    // Markers spread: south facade, center arena, Arch of Constantine.
    geoPOIs: [
      {
        // South facade — visible in initial view
        // View: south of Colosseum, elevated, looking north at arches
        id: 'col-arches',
        title: 'Travertine Arches',
        narration: 'The Colosseum\'s iconic facade features 80 arches across three tiers, each showcasing a different classical order: Doric at the base, Ionic in the middle, and Corinthian at the top. Built from travertine limestone quarried near Tivoli, these arches represent the pinnacle of Roman architectural engineering and once held statues in every upper opening.',
        markerLat: 41.8893,
        markerLng: 12.4925,
        markerAlt: 139,
        viewLat: 41.8882,
        viewLng: 12.4925,
        viewAlt: 230,
        viewHeading: 0,
        viewPitch: -25,
      },
      {
        // Center of Colosseum — visible in initial view
        // View: northeast, elevated, looking SW down into arena
        id: 'col-hypogeum',
        title: 'Arena & Hypogeum',
        narration: 'Beneath the arena floor lies the Hypogeum, a vast two-level underground network spanning 15,000 square meters of tunnels and chambers. Built around 90 AD under Emperor Domitian, this labyrinth once housed gladiators and exotic animals, with 80 vertical shafts and mechanical lifts that dramatically raised fighters and beasts onto the arena floor.',
        markerLat: 41.8901,
        markerLng: 12.4925,
        markerAlt: 139,
        viewLat: 41.8910,
        viewLng: 12.4935,
        viewAlt: 240,
        viewHeading: -140,
        viewPitch: -30,
      },
      {
        // Arch of Constantine — SW of Colosseum
        // View: south, looking north at the arch with Colosseum behind
        id: 'col-constantine',
        title: 'Arch of Constantine',
        narration: 'Standing 21 meters tall just south of the Colosseum, the Arch of Constantine was dedicated in 315 AD to celebrate Emperor Constantine\'s victory at the Battle of Milvian Bridge. This triumphal arch is decorated with reliefs taken from earlier monuments honoring Trajan, Hadrian, and Marcus Aurelius, making it a remarkable gallery of Roman sculpture spanning 200 years.',
        markerLat: 41.8898,
        markerLng: 12.4905,
        markerAlt: 139,
        viewLat: 41.8880,
        viewLng: 12.4910,
        viewAlt: 225,
        viewHeading: 15,
        viewPitch: -22,
      },
    ],
    hotspots: [
      {
        id: 'arcades',
        position: [-14, 2, 1],
        title: 'Arcuated façade',
        description:
          'The rhythm of arches and half-columns (Tuscan, Ionic, Corinthian rising) is a textbook example of Roman concrete architecture dressed in travertine and symbolic order.',
      },
      {
        id: 'cavea',
        position: [-6, 4, 1],
        title: 'Cavea & vomitoria',
        description:
          'Tiered seating wrapped elites, citizens, and women in distinct zones; barrel-vaulted vomitoria could empty tens of thousands of spectators in minutes.',
      },
      {
        id: 'arena',
        position: [-4, -4, 0.85],
        title: 'Arena floor',
        description:
          "Sand (harena) covered the wooden floor; below, the hypogeum's lifts and cages staged animals and stage machinery for increasingly elaborate imperial shows.",
      },
      {
        id: 'east-end',
        position: [8, 0, 1],
        title: 'Long axis',
        description:
          'The oval plan focuses sightlines on the imperial box and processional entries--political theater as much as entertainment for the plebs of Rome.',
      },
    ],
    guidedPath: [
      {
        id: 'co1',
        label: 'Amphitheater overview',
        cameraPosition: [32, 18, 28],
        lookAt: [-4, 0, 1],
      },
      {
        id: 'co2',
        label: 'Arcade rhythm',
        cameraPosition: [16, 8, 14],
        lookAt: [-12, 2, 1],
        hotspotId: 'arcades',
      },
      {
        id: 'co3',
        label: 'Seating tiers',
        cameraPosition: [10, 10, 12],
        lookAt: [-6, 3, 1],
        hotspotId: 'cavea',
      },
      {
        id: 'co4',
        label: 'Arena level',
        cameraPosition: [12, -2, 14],
        lookAt: [-4, -3, 0.9],
        hotspotId: 'arena',
      },
    ],
  },
]

export function getSceneById(id: string): SceneConfig | undefined {
  return SCENES.find((s) => s.id === id)
}

export function preloadAllModels(preload: (url: string) => void) {
  const seen = new Set<string>()
  SCENES.forEach((s) => {
    s.model.layers.forEach((l) => {
      if (!seen.has(l.url)) {
        seen.add(l.url)
        preload(l.url)
      }
    })
  })
}

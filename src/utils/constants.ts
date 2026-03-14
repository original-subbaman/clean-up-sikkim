const PIN_STATUS = {
  OPEN: "OPEN",
  CLOSED: "CLOSED",
  IN_PROGRESS: "IN_PROGRESS",
};

const EVENT_STATUS = {
  ACTIVE: "ACTIVE",
  IN_PROGRESS: "IN_PROGRESS",
  UP_COMING: "UPCOMING",
  CANCELLED: "CANCELLED",
  COMPLETED: "COMPLETED",
};

const RANGE_CONFIG = {
  "1km": {
    geohashLength: 6,
    indexName: "GSI-Geohash-Time",
    attribute: "geohash",
  },
  "5km": {
    geohashLength: 5,
    indexName: "GSI-Geohash5-Time",
    attribute: "geohash5",
  },
  "20km": {
    geohashLength: 4,
    indexName: "GSI-Geohash4-Time",
    attribute: "geohash4",
  },
} as const;

type RangeOption = keyof typeof RANGE_CONFIG;

export { PIN_STATUS, EVENT_STATUS, RANGE_CONFIG, RangeOption };

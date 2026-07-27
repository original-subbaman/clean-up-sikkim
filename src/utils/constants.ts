const PIN_STATUS = {
  REPORTED: "REPORTED",
  VERIFIED: "VERIFIED",
  CLEANED: "CLEANED",
  REJECTED: "REJECTED",
  CLEANUP_SCHEDULED: "CLEANUP_SCHEDULED",
};

const PIN_REACTION = {
  UPVOTE: "UPVOTE",
  FLAG: "FLAG",
};

const EVENT_STATUS = {
  ACTIVE: "ACTIVE",
  IN_PROGRESS: "IN_PROGRESS",
  UP_COMING: "UPCOMING",
  CANCELLED: "CANCELLED",
  COMPLETED: "COMPLETED",
};

const USER_EVENT_STATUS = {
  REGISTERED: "REGISTERED",
  ATTENDED: "ATTENDED",
  NO_SHOW: "NO_SHOW",
};

const RANGE_CONFIG = {
  "1km": {
    geohashLength: 5,
    radiusKm: 1,
    indexName: "GSI-Geohash5-Time",
    attribute: "geohash5",
  },
  "5km": {
    geohashLength: 4,
    radiusKm: 5,
    indexName: "GSI-Geohash4-Time",
    attribute: "geohash4",
  },
  "20km": {
    geohashLength: 3,
    radiusKm: 20,
    indexName: "GSI-Geohash3-Time",
    attribute: "geohash3",
  },
} as const;

type RangeOption = keyof typeof RANGE_CONFIG;

export {
  PIN_STATUS,
  PIN_REACTION,
  EVENT_STATUS,
  RANGE_CONFIG,
  USER_EVENT_STATUS,
  RangeOption,
};

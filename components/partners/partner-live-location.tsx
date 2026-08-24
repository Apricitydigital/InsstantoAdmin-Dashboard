
"use client"

import {
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react"

import {
  GoogleMap,
  InfoWindowF,
  OverlayViewF,
  useJsApiLoader,
} from "@react-google-maps/api"

import {
  collection,
  DocumentReference,
  getDoc,
  onSnapshot,
  Timestamp,
} from "firebase/firestore"

import {
  Activity,
  Clock3,
  LocateFixed,
  MapPin,
  Search,
  Users,
  WifiOff,
  Navigation,
  MapPinned,
  RefreshCw,
  Phone,
  Map,
} from "lucide-react"

import { getFirestoreDb } from "@/lib/firebase"

/* ============================================================
   TYPES
============================================================ */

type PartnerLocation = {
  id: string

  name: string
  phone: string
  city: string

  latitude: number
  longitude: number

  accuracy: number
  altitude: number
  speed: number
  heading: number

  locationEnabled: boolean
  trackingEnabled: boolean
  trackingActive: boolean
  trackingStatus: string

  lastLocationAt?: Timestamp

  partnerRef?: DocumentReference
}

type TrackingStatus =
  | "LIVE"
  | "DELAYED"
  | "LOST"

/* ============================================================
   DEFAULT CENTER
============================================================ */

const DEFAULT_CENTER = {
  lat: 22.7196,
  lng: 75.8577,
}

/* ============================================================
   COMPONENT
============================================================ */

export function PartnerLiveLocation() {
  const db = getFirestoreDb()

  const [partners, setPartners] =
    useState<PartnerLocation[]>([])

  const [
    selectedPartner,
    setSelectedPartner,
  ] =
    useState<PartnerLocation | null>(
      null
    )

  const [search, setSearch] =
    useState("")

  const [filter, setFilter] =
    useState<
      "ALL" | TrackingStatus
    >("ALL")

  const [loading, setLoading] =
    useState(true)

  const [now, setNow] =
    useState(Date.now())

  const mapRef =
    useRef<google.maps.Map | null>(
      null
    )

  const profileCache =
    useRef<
      Record<
        string,
        {
          name: string
          phone: string
          city: string
        }
      >
    >({})

  /* ==========================================================
     GOOGLE MAP
  ========================================================== */

  const {
    isLoaded,
    loadError,
  } = useJsApiLoader({
    id:
      "insstanto-partner-live-map",

    googleMapsApiKey:
      process.env
        .NEXT_PUBLIC_GOOGLE_MAPS_API_KEY ||
      "",
  })

  /* ==========================================================
     REFRESH STATUS TIME
  ========================================================== */

  useEffect(() => {
    const timer =
      setInterval(() => {
        setNow(Date.now())
      }, 30000)

    return () =>
      clearInterval(timer)
  }, [])

  /* ==========================================================
     PARTNER PROFILE USING partnerRef
  ========================================================== */

  const getPartnerProfile =
    async (
      partnerId: string,
      partnerRef?: DocumentReference
    ) => {
      if (
        profileCache.current[
          partnerId
        ]
      ) {
        return profileCache
          .current[partnerId]
      }

      try {
        if (!partnerRef) {
          return {
            name: "Partner",
            phone: "",
            city: "",
          }
        }

        const partnerSnapshot =
          await getDoc(
            partnerRef
          )

        if (
          !partnerSnapshot.exists()
        ) {
          return {
            name: "Partner",
            phone: "",
            city: "",
          }
        }

        const data =
          partnerSnapshot.data()

        const profile = {
          name:
            data.display_name ||
            data.name ||
            "Partner",

          phone:
            data.phone_number ||
            data.contact_no?.toString() ||
            "",

          city:
            data.city || "",
        }

        profileCache.current[
          partnerId
        ] = profile

        return profile
      } catch (error) {
        console.error(
          "Partner profile error:",
          error
        )

        return {
          name: "Partner",
          phone: "",
          city: "",
        }
      }
    }

  /* ==========================================================
     LIVE FIRESTORE LISTENER
  ========================================================== */

  useEffect(() => {
    const locationCollection =
      collection(
        db,
        "partner_live_locations"
      )

    const unsubscribe =
      onSnapshot(
        locationCollection,

        async (snapshot) => {
          try {
            const results =
              await Promise.all(
                snapshot.docs.map(
                  async (
                    locationDoc
                  ) => {
                    const data =
                      locationDoc.data()

                    const latitude =
                      Number(
                        data.latitude
                      )

                    const longitude =
                      Number(
                        data.longitude
                      )

                    if (
                      !Number.isFinite(
                        latitude
                      ) ||
                      !Number.isFinite(
                        longitude
                      )
                    ) {
                      return null
                    }

                    const partnerRef =
                      data.partnerRef as
                        | DocumentReference
                        | undefined

                    const profile =
                      await getPartnerProfile(
                        locationDoc.id,
                        partnerRef
                      )

                    const partner:
                      PartnerLocation =
                      {
                        id:
                          locationDoc.id,

                        name:
                          profile.name,

                        phone:
                          profile.phone,

                        city:
                          profile.city,

                        latitude,
                        longitude,

                        accuracy:
                          Number(
                            data.accuracy ||
                              0
                          ),

                        altitude:
                          Number(
                            data.altitude ||
                              0
                          ),

                        speed:
                          Number(
                            data.speed ||
                              0
                          ),

                        heading:
                          Number(
                            data.heading ||
                              0
                          ),

                        locationEnabled:
                          data.locationEnabled ===
                          true,

                        trackingEnabled:
                          data.trackingEnabled ===
                          true,

                        trackingActive:
                          data.trackingActive ===
                          true,

                        trackingStatus:
                          data.trackingStatus ||
                          "UNKNOWN",

                        lastLocationAt:
                          data.lastLocationAt,

                        partnerRef,
                      }

                    return partner
                  }
                )
              )

            const validPartners =
              results.filter(
                (
                  partner
                ): partner is PartnerLocation =>
                  partner !== null
              )

            setPartners(
              validPartners
            )

            setLoading(false)
          } catch (error) {
            console.error(
              "Partner location processing error:",
              error
            )

            setLoading(false)
          }
        },

        (error) => {
          console.error(
            "partner_live_locations error:",
            error
          )

          setLoading(false)
        }
      )

    return () =>
      unsubscribe()
  }, [db])

  /* ==========================================================
     TRACKING HEALTH
  ========================================================== */

  const getTrackingStatus = (
    partner: PartnerLocation
  ): TrackingStatus => {
    if (
      !partner.locationEnabled ||
      !partner.trackingEnabled
    ) {
      return "LOST"
    }

    if (
      !partner.lastLocationAt
    ) {
      return "LOST"
    }

    const lastUpdate =
      partner.lastLocationAt
        .toDate()
        .getTime()

    const difference =
      now - lastUpdate

    if (
      difference <=
      60 * 1000
    ) {
      return "LIVE"
    }

    if (
      difference <=
      3 * 60 * 1000
    ) {
      return "DELAYED"
    }

    return "LOST"
  }

  /* ==========================================================
     STATUS COLOR
  ========================================================== */

  const getStatusColor = (
    status: TrackingStatus
  ) => {
    if (status === "LIVE") {
      return "#16A34A"
    }

    if (
      status ===
      "DELAYED"
    ) {
      return "#F59E0B"
    }

    return "#EF4444"
  }

  /* ==========================================================
     COUNTS
  ========================================================== */

  const liveCount =
    partners.filter(
      (partner) =>
        getTrackingStatus(
          partner
        ) === "LIVE"
    ).length

  const delayedCount =
    partners.filter(
      (partner) =>
        getTrackingStatus(
          partner
        ) === "DELAYED"
    ).length

  const lostCount =
    partners.filter(
      (partner) =>
        getTrackingStatus(
          partner
        ) === "LOST"
    ).length

  /* ==========================================================
     FILTER
  ========================================================== */

  const filteredPartners =
    useMemo(() => {
      const keyword =
        search
          .trim()
          .toLowerCase()

      return partners.filter(
        (partner) => {
          const status =
            getTrackingStatus(
              partner
            )

          const statusMatched =
            filter === "ALL" ||
            filter === status

          const searchMatched =
            !keyword ||
            partner.name
              .toLowerCase()
              .includes(
                keyword
              ) ||
            partner.phone
              .toLowerCase()
              .includes(
                keyword
              ) ||
            partner.city
              .toLowerCase()
              .includes(
                keyword
              )

          return (
            statusMatched &&
            searchMatched
          )
        }
      )
    }, [
      partners,
      search,
      filter,
      now,
    ])

  /* ==========================================================
     FIT MAP
  ========================================================== */

  const fitAllPartners =
    () => {
      if (
        !mapRef.current ||
        !isLoaded ||
        filteredPartners.length ===
          0
      ) {
        return
      }

      const bounds =
        new google.maps
          .LatLngBounds()

      filteredPartners.forEach(
        (partner) => {
          bounds.extend({
            lat:
              partner.latitude,

            lng:
              partner.longitude,
          })
        }
      )

      mapRef.current.fitBounds(
        bounds
      )

      if (
        filteredPartners.length ===
        1
      ) {
        mapRef.current.setZoom(
          16
        )
      }
    }

  useEffect(() => {
    fitAllPartners()
  }, [
    filteredPartners,
    isLoaded,
  ])

  /* ==========================================================
     LAST SEEN
  ========================================================== */

  const getLastSeen = (
    timestamp?: Timestamp
  ) => {
    if (!timestamp) {
      return "No update"
    }

    const difference =
      now -
      timestamp
        .toDate()
        .getTime()

    const seconds =
      Math.floor(
        difference / 1000
      )

    if (seconds < 10) {
      return "Just now"
    }

    if (seconds < 60) {
      return `${seconds} sec ago`
    }

    const minutes =
      Math.floor(
        seconds / 60
      )

    if (minutes < 60) {
      return `${minutes} min ago`
    }

    const hours =
      Math.floor(
        minutes / 60
      )

    if (hours < 24) {
      return `${hours} hr ago`
    }

    const days =
      Math.floor(
        hours / 24
      )

    return `${days} day ago`
  }

  /* ==========================================================
     FOCUS PARTNER
  ========================================================== */

  const focusPartner = (
    partner: PartnerLocation
  ) => {
    setSelectedPartner(
      partner
    )

    mapRef.current?.panTo({
      lat:
        partner.latitude,

      lng:
        partner.longitude,
    })

    mapRef.current?.setZoom(
      17
    )
  }

  /* ==========================================================
     LOAD ERROR
  ========================================================== */

  if (loadError) {
    return (
      <div className="rounded-2xl border border-red-200 bg-red-50 p-6">
        <p className="font-semibold text-red-600">
          Google Map could not load
        </p>

        <p className="mt-2 text-xs text-red-500">
          Please check your Google Maps API key.
        </p>
      </div>
    )
  }

  /* ==========================================================
     UI
  ========================================================== */

  return (
    <div className="flex h-full min-h-0 flex-col bg-[#F7F9FC]">

      {/* ======================================================
          PAGE HEADER
      ====================================================== */}

      <div className="border-b border-slate-200 bg-white px-6 py-4">

        <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">

          <div>

            <div className="flex items-center gap-3">

              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-cyan-50">
                <MapPinned className="h-5 w-5 text-cyan-600" />
              </div>

              <div>

                <div className="flex items-center gap-2">

                  <h1 className="text-xl font-bold tracking-tight text-slate-800">
                    Partner Live Tracking
                  </h1>

                  <span className="flex items-center gap-1.5 rounded-full border border-emerald-100 bg-emerald-50 px-2.5 py-1 text-[10px] font-bold text-emerald-600">

                    <span className="relative flex h-2 w-2">

                      <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-60" />

                      <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />

                    </span>

                    REALTIME

                  </span>

                </div>

                <p className="mt-1 text-xs text-slate-500">
                  Monitor partner locations, GPS status and tracking activity in realtime
                </p>

              </div>

            </div>

          </div>

          <div className="flex flex-col gap-2 sm:flex-row">

            <div className="relative w-full sm:w-72">

              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />

              <input
                value={search}
                onChange={(event) =>
                  setSearch(
                    event.target.value
                  )
                }
                placeholder="Search partner, mobile or city..."
                className="h-10 w-full rounded-xl border border-slate-200 bg-slate-50 pl-10 pr-4 text-xs text-slate-700 outline-none transition focus:border-cyan-400 focus:bg-white focus:ring-2 focus:ring-cyan-100"
              />

            </div>

            <button
              onClick={
                fitAllPartners
              }
              className="flex h-10 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 text-xs font-semibold text-slate-600 transition hover:bg-slate-50"
            >
              <LocateFixed className="h-4 w-4" />

              Fit Map
            </button>

          </div>

        </div>

      </div>

      {/* ======================================================
          BODY
      ====================================================== */}

      <div className="flex min-h-0 flex-1 flex-col gap-4 p-5">

        {/* ====================================================
            STATS
        ==================================================== */}

        <div className="grid shrink-0 gap-3 sm:grid-cols-2 xl:grid-cols-4">

          <TrackingStatCard
            icon={
              <Users className="h-5 w-5 text-blue-600" />
            }
            iconBackground="bg-blue-50"
            title="Tracking Partners"
            value={partners.length}
            subtitle="Partners with location data"
          />

          <TrackingStatCard
            icon={
              <Activity className="h-5 w-5 text-emerald-600" />
            }
            iconBackground="bg-emerald-50"
            title="Live"
            value={liveCount}
            subtitle="Location updated recently"
          />

          <TrackingStatCard
            icon={
              <Clock3 className="h-5 w-5 text-amber-600" />
            }
            iconBackground="bg-amber-50"
            title="Delayed"
            value={delayedCount}
            subtitle="Location slightly delayed"
          />

          <TrackingStatCard
            icon={
              <WifiOff className="h-5 w-5 text-rose-600" />
            }
            iconBackground="bg-rose-50"
            title="Tracking Lost"
            value={lostCount}
            subtitle="Location update is stale"
          />

        </div>

        {/* ====================================================
            MAP
        ==================================================== */}

        {/* <div className="flex min-h-[580px] flex-1 flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm"> */}
<div className="flex min-h-[680px] flex-1 flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          {/* MAP TOOLBAR */}

          <div className="flex shrink-0 flex-col gap-3 border-b border-slate-100 px-4 py-3 lg:flex-row lg:items-center lg:justify-between">

            <div className="flex items-center gap-3">

              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-cyan-50">

                <Navigation className="h-4 w-4 text-cyan-600" />

              </div>

              <div>

                <p className="text-sm font-semibold text-slate-700">
                  Live Partner Map
                </p>

                <p className="text-[11px] text-slate-400">
                  Click any partner marker to view details
                </p>

              </div>

            </div>

            <div className="flex flex-wrap gap-2">

              <MapFilterButton
                text={`All ${partners.length}`}
                active={
                  filter === "ALL"
                }
                onClick={() =>
                  setFilter("ALL")
                }
              />

              <MapFilterButton
                text={`Live ${liveCount}`}
                active={
                  filter === "LIVE"
                }
                onClick={() =>
                  setFilter("LIVE")
                }
              />

              <MapFilterButton
                text={`Delayed ${delayedCount}`}
                active={
                  filter === "DELAYED"
                }
                onClick={() =>
                  setFilter(
                    "DELAYED"
                  )
                }
              />

              <MapFilterButton
                text={`Lost ${lostCount}`}
                active={
                  filter === "LOST"
                }
                onClick={() =>
                  setFilter("LOST")
                }
              />

            </div>

          </div>

          {/* MAP */}

          {/* <div className="relative min-h-[520px] flex-1"> */}
          <div className="relative h-[calc(100vh-300px)] min-h-[600px] xl:min-h-[680px] 2xl:min-h-[760px]">

            {!isLoaded ||
            loading ? (

              <div className="absolute inset-0 flex items-center justify-center bg-slate-50">

                <div className="text-center">

                  <RefreshCw className="mx-auto h-6 w-6 animate-spin text-cyan-600" />

                  <p className="mt-3 text-xs font-medium text-slate-500">
                    Loading live partner locations...
                  </p>

                </div>

              </div>

            ) : (


<GoogleMap
  mapContainerStyle={{
    width: "100%",
    height: "100%",
  }}
  center={DEFAULT_CENTER}
  zoom={12}
  onLoad={(map) => {
    mapRef.current = map
  }}
  onUnmount={() => {
    mapRef.current = null
  }}
  options={{
    // ✅ Standard Google Maps road view
    mapTypeId: google.maps.MapTypeId.ROADMAP,

    // ✅ Allow deep Google-like zoom
    minZoom: 5,
    maxZoom: 21,

    // ✅ Show/click Google POIs such as
    // hotels, hospitals, shops, restaurants
    clickableIcons: true,

    // ✅ Normal desktop/mobile map behaviour
    gestureHandling: "greedy",

    // Controls
    zoomControl: true,
    fullscreenControl: true,

    // Keep UI clean
    streetViewControl: false,
    mapTypeControl: false,

    // ✅ IMPORTANT:
    // Don't add custom styles here.
    // Default Google style will show roads,
    // buildings, places and businesses.
  }}
>

                {/* ============================================
                    CUSTOM PARTNER MARKERS
                ============================================ */}

                {filteredPartners.map(
                  (partner) => {

                    const status =
                      getTrackingStatus(
                        partner
                      )

                    const color =
                      getStatusColor(
                        status
                      )

                    return (

                      <OverlayViewF
                        key={
                          partner.id
                        }

                        position={{
                          lat:
                            partner.latitude,

                          lng:
                            partner.longitude,
                        }}

                        mapPaneName="overlayMouseTarget"
                      >

                        <button
                          onClick={() =>
                            focusPartner(
                              partner
                            )
                          }

                          className="group -translate-x-1/2 -translate-y-full cursor-pointer border-0 bg-transparent p-0"
                        >

                          <div className="flex items-center gap-2">

                            {/* MARKER */}

                            <div
                              className="relative flex h-9 w-9 shrink-0 items-center justify-center rounded-full border-[3px] border-white shadow-lg transition-transform group-hover:scale-110"
                              style={{
                                backgroundColor:
                                  color,
                              }}
                            >

                              <MapPin className="h-4 w-4 text-white" />

                              {status ===
                                "LIVE" && (

                                <span className="absolute -right-1 -top-1 h-3 w-3 rounded-full border-2 border-white bg-emerald-400" />

                              )}

                            </div>

                            {/* NAME LABEL */}

                            <div className="whitespace-nowrap rounded-xl border border-slate-200 bg-white px-3 py-2 shadow-lg transition group-hover:-translate-y-0.5 group-hover:shadow-xl">

                              <div className="flex items-center gap-2">

                                <span className="max-w-[170px] truncate text-[11px] font-bold text-slate-800">
                                  {partner.name}
                                </span>

                                <span
                                  className="h-2 w-2 rounded-full"
                                  style={{
                                    backgroundColor:
                                      color,
                                  }}
                                />

                              </div>

                              <p className="mt-0.5 text-left text-[9px] font-medium text-slate-400">
                                {getLastSeen(
                                  partner.lastLocationAt
                                )}
                              </p>

                            </div>

                          </div>

                          {/* POINTER */}

                          <div
                            className="ml-[14px] h-0 w-0 border-l-[5px] border-r-[5px] border-t-[7px] border-l-transparent border-r-transparent"
                            style={{
                              borderTopColor:
                                color,
                            }}
                          />

                        </button>

                      </OverlayViewF>

                    )
                  }
                )}

                {/* ============================================
                    PARTNER DETAIL POPUP
                ============================================ */}

                {selectedPartner && (

                  <InfoWindowF
                    position={{
                      lat:
                        selectedPartner
                          .latitude,

                      lng:
                        selectedPartner
                          .longitude,
                    }}

                    onCloseClick={() =>
                      setSelectedPartner(
                        null
                      )
                    }
                  >

                    <div className="w-[270px] p-1">

                      <div className="flex items-start gap-3">

                        <div
                          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl"
                          style={{
                            backgroundColor:
                              `${getStatusColor(
                                getTrackingStatus(
                                  selectedPartner
                                )
                              )}15`,
                          }}
                        >

                          <MapPin
                            className="h-5 w-5"
                            style={{
                              color:
                                getStatusColor(
                                  getTrackingStatus(
                                    selectedPartner
                                  )
                                ),
                            }}
                          />

                        </div>

                        <div className="min-w-0 flex-1">

                          <div className="flex items-start justify-between gap-2">

                            <div className="min-w-0">

                              <p className="truncate text-sm font-bold text-slate-800">
                                {
                                  selectedPartner.name
                                }
                              </p>

                              {selectedPartner.city && (

                                <p className="mt-0.5 text-[10px] text-slate-400">
                                  {
                                    selectedPartner.city
                                  }
                                </p>

                              )}

                            </div>

                            <StatusBadge
                              status={
                                getTrackingStatus(
                                  selectedPartner
                                )
                              }
                            />

                          </div>

                        </div>

                      </div>

                      {selectedPartner.phone && (

                        <div className="mt-3 flex items-center gap-2 rounded-lg bg-slate-50 px-3 py-2">

                          <Phone className="h-3.5 w-3.5 text-slate-400" />

                          <span className="text-xs font-medium text-slate-600">
                            {
                              selectedPartner.phone
                            }
                          </span>

                        </div>

                      )}

                      <div className="my-3 border-t border-slate-100" />

                      <div className="grid grid-cols-2 gap-2">

                        <DetailBox
                          label="GPS"
                          value={
                            selectedPartner.locationEnabled
                              ? "ON"
                              : "OFF"
                          }
                        />

                        <DetailBox
                          label="Last Update"
                          value={
                            getLastSeen(
                              selectedPartner.lastLocationAt
                            )
                          }
                        />

                        <DetailBox
                          label="Accuracy"
                          value={`${Math.round(
                            selectedPartner.accuracy
                          )} m`}
                        />

                        <DetailBox
                          label="Speed"
                          value={`${selectedPartner.speed.toFixed(
                            1
                          )} m/s`}
                        />

                      </div>

                      <div className="mt-3 flex items-center gap-2 rounded-lg border border-slate-100 bg-slate-50 p-2">

                        <Map className="h-3.5 w-3.5 text-slate-400" />

                        <span className="text-[10px] font-medium text-slate-500">

                          {selectedPartner.latitude.toFixed(
                            6
                          )}

                          {", "}

                          {selectedPartner.longitude.toFixed(
                            6
                          )}

                        </span>

                      </div>

                    </div>

                  </InfoWindowF>

                )}

              </GoogleMap>

            )}

          </div>

        </div>

      </div>

    </div>
  )
}

/* ============================================================
   STAT CARD
============================================================ */

function TrackingStatCard({
  icon,
  iconBackground,
  title,
  value,
  subtitle,
}: {
  icon: React.ReactNode
  iconBackground: string
  title: string
  value: number
  subtitle: string
}) {
  return (
    <div className="group rounded-2xl border border-slate-200 bg-white p-4 shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md">

      <div className="flex items-center justify-between">

        <div>

          <p className="text-[11px] font-semibold text-slate-500">
            {title}
          </p>

          <p className="mt-1 text-2xl font-bold tracking-tight text-slate-800">
            {value}
          </p>

          <p className="mt-1 text-[10px] text-slate-400">
            {subtitle}
          </p>

        </div>

        <div
          className={`flex h-11 w-11 items-center justify-center rounded-xl ${iconBackground}`}
        >
          {icon}
        </div>

      </div>

    </div>
  )
}

/* ============================================================
   FILTER BUTTON
============================================================ */

function MapFilterButton({
  text,
  active,
  onClick,
}: {
  text: string
  active: boolean
  onClick: () => void
}) {
  return (
    <button
      onClick={
        onClick
      }

      className={
        active
          ? "rounded-xl bg-slate-800 px-3.5 py-2 text-[10px] font-bold text-white shadow-sm"
          : "rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-[10px] font-semibold text-slate-500 transition hover:border-slate-300 hover:bg-slate-50"
      }
    >
      {text}
    </button>
  )
}

/* ============================================================
   STATUS
============================================================ */

function StatusBadge({
  status,
}: {
  status: TrackingStatus
}) {
  const styles = {
    LIVE:
      "bg-emerald-50 text-emerald-600 border-emerald-100",

    DELAYED:
      "bg-amber-50 text-amber-600 border-amber-100",

    LOST:
      "bg-rose-50 text-rose-600 border-rose-100",
  }

  return (
    <span
      className={`rounded-full border px-2 py-1 text-[8px] font-bold ${styles[status]}`}
    >
      {status}
    </span>
  )
}

/* ============================================================
   DETAIL BOX
============================================================ */

function DetailBox({
  label,
  value,
}: {
  label: string
  value: string
}) {
  return (
    <div className="rounded-lg bg-slate-50 p-2.5">

      <p className="text-[9px] text-slate-400">
        {label}
      </p>

      <p className="mt-1 truncate text-[11px] font-bold text-slate-700">
        {value}
      </p>

    </div>
  )
}
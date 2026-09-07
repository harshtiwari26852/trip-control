const TRIPS = [
  {
    title: 'Madeira Hiking and Romance',
    days: '10 days',
    madeFor: 'Made for Hugo and Kenneth',
    img: 'https://cdn.dev.beautifuldestinations.app/images/Skiathos_8f922c54-cd07-4eb5-b8c1-289bbe3a34fa.jpg',
  },
  {
    title: 'Family Flight Trip to Amsterdam',
    days: '3 days',
    madeFor: 'Made for Casper and family',
    img: 'https://cdn.dev.beautifuldestinations.app/images/Mount%20Fuji_7f2190fc-be10-448f-8021-be671fe84333.jpg',
  },
  {
    title: 'Lefkada Kayaking & Beach Escape',
    days: '10 days',
    madeFor: 'Made for Reuben and Sylvie',
    img: 'https://cdn.dev.beautifuldestinations.app/images/Rome_4bb95503-9232-4d0e-8726-54085f1b7e1b.jpg',
  },
  {
    title: 'Family Kuala Lumpur Adventure',
    days: '7 days',
    madeFor: 'Made for Vernon and family',
    img: 'https://cdn.dev.beautifuldestinations.app/images/Krabi_bfd9cdbb-f1fa-493c-b8df-1d19176acd6a.jpg',
  },
  {
    title: 'Luxury Family Antalya Escape',
    days: '10 days',
    madeFor: 'Made for Hamish and family',
    img: 'https://cdn.dev.beautifuldestinations.app/images/Cape%20Town_9d8871d2-48f9-4317-9e09-d2b44d98314f.jpg',
  },
  {
    title: 'Budget Solo Paris Adventure',
    days: '7 days',
    madeFor: 'Made for Zachary',
    img: 'https://cdn.dev.beautifuldestinations.app/images/Fes_6a48b3c2-e492-4abe-9140-4e35258af575.jpg',
  },
]

export default function Trips() {
  return (
    <section className="px-[clamp(37px,3.594vw,57px)] pt-[clamp(57px,11.25vh,135px)] pb-[clamp(38px,7.5vh,90px)]">
      <div className="mx-auto w-full max-w-[1600px]">
        <h2 className="text-primary text-center text-[clamp(1.75rem,3.13vw,3.25rem)] leading-none font-medium">
          Trips tailored to you
        </h2>
        <p className="text-primary mt-[clamp(5px,1vh,12px)] text-center text-[clamp(1rem,1.41vw,1.5rem)] leading-none font-medium">
          2,355,684+ trips shaped around what travelers really wanted
        </p>
      </div>

      <div className="mt-[clamp(34px,6.75vh,81px)] -mx-[clamp(37px,3.594vw,57px)] animate-trips-row-fade-in">
        <div className="relative overflow-hidden">
          <div className="flex overflow-x-auto pb-4">
            {TRIPS.map((trip) => (
              <div
                key={trip.title}
                className="min-w-0 flex-[0_0_auto] pl-[clamp(12px,1.25vw,20px)] w-[calc(clamp(168px,14.5vw,232px)+clamp(12px,1.25vw,20px))]"
              >
                <a
                  href="#"
                  className="group relative flex aspect-[273/381] w-full flex-col justify-end overflow-hidden rounded-[20px] bg-trip-card-placeholder"
                >
                  <div className="absolute inset-0 z-0">
                    <img
                      src={trip.img}
                      alt=""
                      loading="lazy"
                      className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                    />
                  </div>

                  {/* Bottom-up scrim */}
                  <div className="pointer-events-none absolute inset-x-0 bottom-0 h-[28%] bg-linear-to-t from-card-scrim/95 via-card-scrim/55 to-transparent" />

                  <span className="bg-foreground text-muted absolute top-3 right-3 rounded-full px-2.5 py-1 text-base leading-none font-normal">
                    {trip.days}
                  </span>

                  <div className="relative flex flex-col gap-1 px-4 pt-4 pb-5">
                    <h3 className="text-background text-xl leading-[1.35] font-semibold">
                      {trip.title}
                    </h3>
                    <p className="text-background/85 text-base leading-[1.31] font-normal">
                      {trip.madeFor}
                    </p>
                  </div>
                </a>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  )
}

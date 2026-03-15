function IconImg({
  src,
  alt,
  className = "",
}: {
  src: string;
  alt: string;
  className?: string;
}) {
  return <img src={src} alt={alt} className={className} />;
}

export default function LandingPage() {
  const featureCards = [
    {
      icon: "/icons/feature-translate.png",
      title: "Real-time Translation",
      desc: "Instant conversion of ASL signs into clear text and speech output on your device screen.",
    },
    {
      icon: "/icons/feature-landmark.png",
      title: "Landmark Detection",
      desc: "Precise tracking of 21 individual hand points for high-fidelity gesture recognition.",
    },
    {
      icon: "/icons/feature-tutorial.png",
      title: "Alphabet Tutorial",
      desc: "Comprehensive modules for learning ASL finger spelling from basics to advanced levels.",
    },
    {
      icon: "/icons/feature-tips.png",
      title: "Accuracy Tips",
      desc: "Smart suggestions on lighting and positioning to ensure the best possible recognition rate.",
    },
  ];

  const steps = [
    {
      icon: "/icons/step-camera.png",
      title: "1. Open Camera",
      desc: "Launch the SignSight app and grant camera permissions to start detecting.",
    },
    {
      icon: "/icons/step-hand.png",
      title: "2. Show Sign",
      desc: "Position your hand clearly within the camera frame for the AI to track.",
    },
    {
      icon: "/icons/step-detect.png",
      title: "3. App Detects",
      desc: "Our neural network processes the landmarks and shows the text instantly.",
    },
  ];

  const footerCols = [
    {
      title: "Product",
      links: ["Features", "Download", "Release Notes"],
    },
    {
      title: "Resources",
      links: ["ASL Basics", "Tutorials", "Accuracy Tips"],
    },
    {
      title: "Legal",
      links: ["Privacy Policy", "Terms of Service", "GitHub Repo"],
    },
  ];

  return (
    <div className="relative flex min-h-screen w-full flex-col overflow-x-hidden bg-[#f8f7f6] font-display text-slate-900 antialiased">
      <header className="sticky top-0 z-50 flex items-center justify-between whitespace-nowrap border-b border-solid border-[#e66e19]/10 bg-[#f8f7f6]/80 px-6 py-4 backdrop-blur-md md:px-20 lg:px-40">
        <div className="flex items-center gap-2 text-[#e66e19]">
          <IconImg
            src="/icons/logo.png"
            alt="SignSight logo"
            className="h-7 w-7 object-contain"
          />
          <h2 className="text-xl font-black leading-tight tracking-tight text-slate-900 dark:text-slate-100">
            SignSight
          </h2>
        </div>

        <div className="hidden flex-1 items-center justify-end gap-8 md:flex">
          <nav className="flex items-center gap-8">
            <a
              className="text-sm font-medium text-slate-700 transition-colors hover:text-[#e66e19] dark:text-slate-800"
              href="#features"
            >
              Features
            </a>
            <a
              className="text-sm font-medium text-slate-700 transition-colors hover:text-[#e66e19] dark:text-slate-800"
              href="#how-it-works"
            >
              How it Works
            </a>
            <a
              className="text-sm font-medium text-slate-700 transition-colors hover:text-[#e66e19] dark:text-slate-800"
              href="#preview"
            >
              Preview
            </a>
          </nav>

          <button className="bg-[#e66e19] flex h-10 min-w-[120px] cursor-pointer items-center justify-center rounded-full bg-#e66e19 px-5 text-sm font-bold text-white shadow-lg shadow-primary/20 transition-transform hover:scale-105">
            Download
          </button>
        </div>

        <div className="md:hidden">
          <img
            src="/icons/menu.png"
            alt="Menu"
            className="h-6 w-6 object-contain"
          />
        </div>
      </header>

      <main className="flex-1">
        <section className="hero-gradient px-6 py-12 md:px-20 md:py-20 lg:px-40">
          <div className="grid grid-cols-1 items-center gap-12 lg:grid-cols-2">
            <div className="flex max-w-xl flex-col gap-6">
              <div className="inline-flex w-fit items-center gap-2 rounded-full bg-primary/10 px-3 py-1 text-xs font-bold uppercase tracking-wider text-[#e66e19]">
                <span className="relative flex h-2 w-2">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary opacity-75" />
                  <span className="relative inline-flex h-2 w-2 rounded-full bg-primary" />
                </span>
                Powered by MediaPipe AI
              </div>

              <h1 className="text-5xl font-black leading-[1.1] tracking-tight text-slate-900 dark:text-slate-100 md:text-6xl">
                ASL Landmark <span className="text-[#e66e19]">Translator</span>
              </h1>

              <p className="text-lg font-normal leading-relaxed text-slate-600 dark:text-slate-400 md:text-xl">
                Breaking communication barriers in real-time. Experience seamless
                sign language interpretation using advanced computer vision
                technology.
              </p>

              <div className="mt-4 flex flex-wrap gap-4">
                <button className="bg-[#e66e19] flex min-w-[180px] cursor-pointer items-center justify-center gap-2 rounded-full bg-primary px-8 text-base font-bold text-white shadow-xl shadow-primary/30 transition-all duration-200 hover:scale-105 hover:bg-primary/90 active:scale-95 h-14">
                  <IconImg
                    src="/icons/android.png"
                    alt="Android"
                    className="h-5 w-5 object-contain"
                  />
                  Download for Android
                </button>

                <button className="flex min-w-[140px] cursor-pointer items-center justify-center rounded-lg border-2 border-primary/20 bg-transparent px-8 text-base font-bold text-slate-900 transition-all hover:bg-primary/5 h-14 dark:text-slate-100">
                  Learn More
                </button>
              </div>
            </div>

            <div className="relative flex justify-center lg:justify-end">
              <div className="phone-float relative w-full max-w-[400px] aspect-[9/19] rounded-[3rem] border-[8px] border-slate-800 bg-slate-900 p-3 shadow-2xl">
                <div className="absolute left-1/2 top-0 z-10 h-6 w-32 -translate-x-1/2 rounded-b-2xl bg-slate-800" />
                <div className="relative h-full w-full overflow-hidden rounded-[2rem] bg-slate-200">
                  <img
                    className="h-full w-full object-cover"
                    alt="Mobile app interface showing hand tracking landmarks"
                    src="https://lh3.googleusercontent.com/aida-public/AB6AXuD1H47NcDGuynTMsuC1EdjWIWqEtUD9GzD6Yf84YXyFHpQ44qNjJBJBPg3taukD25lJAQtvAjmFpuddTP4tvtMk5kt-1pkdQeqiz_jjdLquAx3qCVvSCYt5UB6zZZigXNgODxkRQJXHqga91Rn7mH2v_0KLdktWUV-LTSvPweW5ueszOwqamXhNVVFJmlIhP3lvVzlHKxq5OLusKaJssVV18bZBlAoTQb2WNfWiitzKAmpD953cGaPOka2g6IZcJEm3mEwLqypJOg"
                  />
                  <div className="absolute inset-0 flex items-center justify-center bg-primary/10">
                    <div className="flex flex-col items-center gap-2 rounded-xl border border-white/50 bg-white/80 p-4 shadow-lg backdrop-blur-sm">
                      <IconImg
                        src="/icons/hero-hand.png"
                        alt="Detected hand sign"
                        className="h-10 w-10 object-contain"
                      />
                      <span className="text-lg font-bold text-slate-900">
                        "Hello"
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              <div className="absolute -bottom-6 -left-6 max-w-[200px] rounded-2xl border border-[#e66e19]/10 bg-white p-6 shadow-xl md:-left-12 dark:bg-slate-800">
                <div className="mb-2 flex items-center gap-3">
                  <div className="flex size-8 items-center justify-center rounded-full bg-green-500/20 text-green-600">
                    <IconImg
                      src="/icons/verified.png"
                      alt="Verified"
                      className="h-4 w-4 object-contain"
                    />
                  </div>
                  <span className="text-sm font-bold">98% Accuracy</span>
                </div>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Optimized landmark detection for low-light environments.
                </p>
              </div>
            </div>
          </div>
        </section>

        <section
          id="features"
          className="bg-primary/5 px-6 py-20 md:px-20 lg:px-40"
        >
          <div className="mb-16 flex flex-col items-center gap-4 text-center">
            <h2 className="text-4xl font-black tracking-tight text-slate-900 dark:text-slate-100">
              Powerful AI Features
            </h2>
            <p className="max-w-2xl text-lg text-slate-600 dark:text-slate-400">
              Bridging the gap with industry-leading computer vision and
              real-time processing capabilities.
            </p>
          </div>

          <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-4">
            {featureCards.map((feature) => (
              <div
                key={feature.title}
                className="flex flex-col gap-4 rounded-xl border border-[#e66e19]/10 bg-[#f8f7f6] p-8 shadow-sm transition-all duration-300 hover:-translate-y-2 hover:shadow-xl dark:bg-background-dark"
              >
                <div className=" bg-[#FACB8F]  mb-2 flex size-12 items-center justify-center rounded-full bg-primary/10 text-[#e66e19]">
                  <IconImg
                    src={feature.icon}
                    alt={feature.title}
                    className="h-5 w-5 object-contain "
                  />
                </div>
                <h3 className="text-xl font-bold text-orange-900 dark:text-black-100">
                  {feature.title}
                </h3>
                <p className="text-sm leading-relaxed text-slate-600 dark:text-slate-400">
                  {feature.desc}
                </p>
              </div>
            ))}
          </div>
        </section>

        <section
          id="how-it-works"
          className="px-6 py-24 md:px-20 lg:px-40"
        >
          <h2 className="mb-20 text-center text-3xl font-black leading-tight text-slate-900 dark:text-slate-100 md:text-4xl">
            How it Works
          </h2>

          <div className="relative grid grid-cols-1 gap-12 md:grid-cols-3">
            <div className="absolute left-0 top-10 hidden h-0.5 w-full -z-0 bg-primary/20 md:block" />

            {steps.map((step) => (
              <div
                key={step.title}
                className="group flex flex-col items-center text-center"
              >
                <div className=" bg-[#E66E19] relative z-10 mb-6 flex size-20 items-center justify-center rounded-full bg-primary text-white shadow-xl shadow-primary/40 transition-transform group-hover:scale-110">
                  <IconImg
                    src={step.icon}
                    alt={step.title}
                    className="h-8 w-8 object-contain"
                  />
                </div>
                <h4 className="mb-3 text-xl font-bold text-slate-900 dark:text-slate-100">
                  {step.title}
                </h4>
                <p className="leading-relaxed text-slate-600 dark:text-slate-400">
                  {step.desc}
                </p>
              </div>
            ))}
          </div>
        </section>

        <section
          id="preview"
          className="overflow-hidden bg-slate-900 px-6 py-20 md:px-20 lg:px-40"
        >
          <div className="mx-auto mb-16 flex max-w-4xl flex-col items-center gap-6 text-center">
            <h2 className="text-4xl font-black text-white">
              Experience SignSight
            </h2>
            <p className="text-lg text-slate-400">
              Clean, intuitive, and lightning fast. Designed for accessibility
              and everyday use.
            </p>
          </div>

          <div className="flex flex-wrap justify-center gap-12 overflow-visible md:gap-24">
            <div className="relative h-[500px] w-64 rotate-[-3deg] rounded-[2.5rem] border-4 border-slate-700 bg-slate-800 p-2 shadow-2xl transition-transform duration-500 hover:rotate-0">
              <div className="h-full w-full overflow-hidden rounded-[2rem] bg-white">
                <img
                  className="h-full w-full object-cover opacity-80"
                  alt="Data visualization of hand tracking points"
                  src="https://lh3.googleusercontent.com/aida-public/AB6AXuCWmjEkvD6tQvr_MU3xdKDRmhP13RMIkG2horzUylpUTFn7WkVxdUlI1PHYTnfB3_6NlIMNDvuVdx3VTsBHpflImjKkEEo0-0qDXf0TJAMXmRA9CROJ7xoaU5QL7Mpibw7auVDsgG6aLYOXULOMC2c5PQoBaKE7Mfw_7Y09SY26kmkdfVNoMsNw2updrSCwtFK2Gll-rZ95ExBEyl0xD_424v0em6ZvuBgnvwYpncEluRhnMmk8Q8WPp_RRWvBbWA2dhzsWzTahAA"
                />
                <div className="absolute inset-x-0 top-10 flex flex-col items-center px-4">
                  <div className="mb-4 flex h-8 w-full items-center rounded-lg bg-slate-100 px-2">
                    <div className="mr-2 size-2 rounded-full bg-primary" />
                    <div className="h-2 w-20 rounded-full bg-slate-300" />
                  </div>
                </div>
              </div>
            </div>

            <div className="relative z-10 h-[500px] w-64 rounded-[2.5rem] border-4 border-slate-700 bg-slate-800 p-2 shadow-2xl transition-transform duration-500 hover:scale-105">
              <div className="flex h-full w-full items-center justify-center rounded-[2rem] bg-primary/10 p-6 text-center">
                <div>
                  <IconImg
                    src="/icons/preview-abc.png"
                    alt="Alphabet mode"
                    className="mx-auto mb-4 h-10 w-10 object-contain"
                  />
                  <h5 className="mb-2 text-xl font-bold text-slate-900">
                    Alphabet Mode
                  </h5>
                  <p className="text-sm text-slate-600">
                    Practice letter by letter with instant feedback.
                  </p>
                </div>
              </div>
            </div>

            <div className="relative h-[500px] w-64 rotate-3 rounded-[2.5rem] border-4 border-slate-700 bg-slate-800 p-2 shadow-2xl transition-transform duration-500 hover:rotate-0">
              <div className="h-full w-full overflow-hidden rounded-[2rem] bg-white">
                <img
                  className="h-full w-full object-cover opacity-20"
                  alt="Technical code background"
                  src="https://lh3.googleusercontent.com/aida-public/AB6AXuAXdBs7sQ1VEkssujn9knVS0_oWqzTV0YJG9_ee4ALho8KWH_zhKuIXB4OVU-7QSHY1LuNpUWx0kwkWmT6OHKN7h-bH_aIWNXQz3LgRsiKk_qpsEkHzF2lXiBWz_NWulIrYkwzK1dXbNGrGM7rQCXPI9udDctrHGumoxO2LLmGAhV62jxbMF7_0JypLYzCw0Nnh1b0i-GjF0C89RUd-o0NUSyTyXlHiBayUdQDSB0cPw3Qjh_LJkaE7m-JAkf8xuzfw2W0QKcS0Fg"
                />
                <div className="absolute inset-0 flex flex-col items-center justify-center p-6">
                  <div className="mb-4 flex size-16 items-center justify-center rounded-full bg-green-500 text-white">
                    <IconImg
                      src="/icons/check.png"
                      alt="Perfect match"
                      className="h-7 w-7 object-contain"
                    />
                  </div>
                  <h5 className="font-bold text-slate-900">Perfect Match</h5>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="px-6 py-20 md:px-20 lg:px-40">
          <div className="rounded-xl bg-gradient-to-r from-primary to-orange-500 p-10 text-white shadow-2xl md:rounded-lg md:p-20">
            <div className="flex flex-col items-center justify-between gap-10 md:flex-row">
              <div className="flex max-w-xl flex-col gap-4">
                <h2 className="text-3xl font-black tracking-tight md:text-5xl">
                  Ready to bridge the communication gap?
                </h2>
                <p className="text-lg text-white/80">
                  Download SignSight today and start communicating more
                  effectively with the deaf and hard-of-hearing community.
                </p>
              </div>

              <div className="flex w-full flex-col gap-4 md:w-auto">
                <button className="flex h-16 items-center justify-center gap-3 rounded-full bg-white px-8 text-lg font-black text-[#e66e19] shadow-lg transition-colors hover:bg-slate-100">
                  <IconImg
                    src="/icons/download.png"
                    alt="Download"
                    className="h-5 w-5 object-contain"
                  />
                  Get for Android
                </button>
                <p className="text-center text-sm text-white/60">
                  Coming soon to iOS
                </p>
              </div>
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-[#e66e19]/10 bg-[#f8f7f6] px-6 py-16 md:px-20 lg:px-40 dark:bg-background-dark">
        <div className="mb-12 grid grid-cols-1 gap-12 md:grid-cols-4">
          <div className="col-span-1 flex flex-col gap-6 md:col-span-1">
            <div className="flex items-center gap-2 text-[#e66e19]">
              <IconImg
                src="/icons/logo.png"
                alt="SignSight logo"
                className="h-7 w-7 object-contain"
              />
              <h2 className="text-xl font-black text-slate-900 dark:text-slate-100">
                SignSight
              </h2>
            </div>

            <p className="text-sm leading-relaxed text-slate-600 dark:text-slate-400">
              Developing open-source AI tools to improve accessibility and
              break down communication barriers worldwide.
            </p>

            <div className="flex gap-4">
              <a className="text-slate-400 hover:text-[#e66e19]" href="#">
                <IconImg
                  src="/icons/footer-globe.png"
                  alt="Website"
                  className="h-4 w-4 object-contain"
                />
              </a>
              <a className="text-slate-400 hover:text-[#e66e19]" href="#">
                <IconImg
                  src="/icons/footer-share.png"
                  alt="Share"
                  className="h-4 w-4 object-contain"
                />
              </a>
            </div>
          </div>

          {footerCols.map((col) => (
            <div key={col.title}>
              <h4 className="mb-6 font-bold text-slate-900 dark:text-slate-100">
                {col.title}
              </h4>
              <ul className="flex flex-col gap-4 text-sm text-slate-600 dark:text-slate-400">
                {col.links.map((link) => (
                  <li key={link}>
                    <a className="hover:text-[#e66e19]" href="#">
                      {link}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="flex flex-col items-center justify-between gap-6 border-t border-[#e66e19]/10 pt-12 md:flex-row">
          <p className="text-sm text-slate-500">
            © 2024 SignSight AI. All rights reserved.
          </p>
          <div className="flex items-center gap-4 text-sm font-bold text-slate-900 dark:text-slate-100">
            <IconImg
              src="/icons/footer-code.png"
              alt="Code"
              className="h-4 w-4 object-contain"
            />
            Built with MediaPipe &amp; TensorFlow
          </div>
        </div>
      </footer>
    </div>
  );
}
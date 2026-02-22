"use client";

import { motion, useInView, AnimatePresence } from "framer-motion";
import { useRef, useState } from "react";
import { X } from "lucide-react";
import Image from "next/image";

const galleryItems = [
  { id: 1, title: "Scholars Convocation", src: "/scholars.jpg", span: "col-span-2 row-span-2" },
  { id: 2, title: "Leadership Workshop", src: "/scholar1.jpg", span: "" },
  { id: 3, title: "Community Outreach", src: "/scholar2.jpg", span: "" },
  { id: 4, title: "Mentorship Session", src: "/scholar3.jpg", span: "" },
  { id: 5, title: "Graduation Ceremony", src: "/scholars4.jpg", span: "" },
  { id: 6, title: "Group Discussion", src: "/scholars5.jpg", span: "col-span-2" },
  { id: 7, title: "Academic Session", src: "/scholars6.jpg", span: "" },
  { id: 8, title: "Foundation Event", src: "/scholars7.jpg", span: "" },
  { id: 9, title: "Scholar Gathering", src: "/scholars8.jpg", span: "col-span-2 row-span-2" },
  { id: 10, title: "Program Ceremony", src: "/scholars9.jpg", span: "" },
  { id: 11, title: "Team Building", src: "/scholars10.jpg", span: "" },
  { id: 12, title: "Award Presentation", src: "/scholars11.jpg", span: "col-span-2" },
];

export default function Gallery() {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, margin: "-100px" });
  const [selected, setSelected] = useState(null);

  return (
    <section id="gallery" className="bg-white py-24">
      <div ref={ref} className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={isInView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.7 }}
          className="text-center"
        >
          <span className="text-sm font-semibold uppercase tracking-widest text-gold">
            Moments
          </span>
          <h2 className="mt-3 text-3xl font-bold text-royal sm:text-4xl">
            Life at Kufuor Scholars
          </h2>
          <p className="mx-auto mt-4 max-w-2xl text-lg text-gray-600">
            Capturing the transformative experiences of our scholars.
          </p>
        </motion.div>

        <div className="mt-12 grid auto-rows-[200px] grid-cols-2 gap-4 md:grid-cols-4">
          {galleryItems.map((item, i) => (
            <motion.div
              key={item.id}
              initial={{ opacity: 0, scale: 0.9 }}
              animate={isInView ? { opacity: 1, scale: 1 } : {}}
              transition={{ duration: 0.5, delay: 0.1 + i * 0.08 }}
              onClick={() => setSelected(item)}
              className={`group relative cursor-pointer overflow-hidden rounded-xl ${item.span}`}
            >
              <Image
                src={item.src}
                alt={item.title}
                fill
                sizes="(max-width: 768px) 50vw, 25vw"
                className="object-cover transition-transform duration-500 group-hover:scale-110"
              />
              <div className="absolute inset-0 bg-black/0 transition-all duration-300 group-hover:bg-black/30" />
              <div className="absolute bottom-0 left-0 right-0 translate-y-full bg-gradient-to-t from-black/70 to-transparent p-4 transition-transform duration-300 group-hover:translate-y-0">
                <p className="text-sm font-medium text-white">{item.title}</p>
              </div>
            </motion.div>
          ))}
        </div>
      </div>

      {/* Lightbox */}
      <AnimatePresence>
        {selected && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setSelected(null)}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4"
          >
            <motion.div
              initial={{ scale: 0.8 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0.8 }}
              className="relative max-h-[80vh] max-w-4xl overflow-hidden rounded-2xl"
              onClick={(e) => e.stopPropagation()}
            >
              <Image
                src={selected.src}
                alt={selected.title}
                width={1200}
                height={800}
                className="h-auto max-h-[80vh] w-auto rounded-2xl object-contain"
              />
              <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/60 to-transparent p-6">
                <p className="text-lg font-medium text-white">
                  {selected.title}
                </p>
              </div>
              <button
                onClick={() => setSelected(null)}
                className="absolute right-4 top-4 rounded-full bg-black/40 p-2 text-white backdrop-blur-sm hover:bg-black/60"
              >
                <X size={20} />
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </section>
  );
}

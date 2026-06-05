import React from "react";
import { motion, Variants } from "framer-motion";
import { EarthCanvas } from "@/components/canvas";

const slideIn = (direction: "left" | "right", type: "tween" | "spring", delay = 0, duration = 0.8): Variants => ({
  hidden: { x: direction === "left" ? -100 : 100, opacity: 0 },
  show: {
    x: 0,
    opacity: 1,
    transition: { type, delay, duration },
  },
});

const Contact: React.FC = () => {
  return (
    <div className="xl:mt-12 flex xl:flex-row flex-col-reverse gap-10 overflow-hidden">
      

      <motion.div
        variants={slideIn("right", "tween", 0.2, 1)}
        initial="hidden"
        whileInView="show"
        viewport={{ once: true, amount: 0.2 }}
        className="xl:flex-1 xl:h-auto md:h-[550px] h-[350px]"
      >
        <EarthCanvas />
      </motion.div>
    </div>
  );
};

export default Contact;

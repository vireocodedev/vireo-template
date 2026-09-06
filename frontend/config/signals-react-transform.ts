import babel from "@rolldown/plugin-babel";

export function signalsReactTransform() {
  return babel({
    plugins: [["module:@preact/signals-react-transform"]],
  });
}

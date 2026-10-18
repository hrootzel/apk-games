/** Input/UI settings are intentionally separate from CRT/phosphor rendering. */
export interface InputSettings {
  controlOpacity: number;
  controlSize: number;
  controlInset: number;
  dragSteering: number;
  combinedFireThrust: number;
}

export const defaultInputSettings: InputSettings = {
  controlOpacity: 0.55,
  controlSize: 76,
  controlInset: 16,
  dragSteering: 0,
  combinedFireThrust: 1,
};

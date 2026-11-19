import type { LabApi } from '../../shared/contracts.ts';
declare global {
  interface Window {
    orangeCat?: LabApi;
  }
}
export {};

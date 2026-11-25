import Constants from 'expo-constants'

export function mobileUsesVendorServices(): boolean {
  return Constants.expoConfig?.name === 'Orca'
}

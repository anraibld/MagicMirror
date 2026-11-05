#!/bin/bash
nmcli -t -f NAME,TYPE connection show | while IFS=: read -r name type; do
  case "$type" in
    *ethernet) nmcli connection modify "$name" connection.autoconnect yes connection.autoconnect-priority 100 ipv4.route-metric 100 ipv6.route-metric 100 && echo "ethernet: $name -> prioritet 100";;
    *wireless) nmcli connection modify "$name" connection.autoconnect yes connection.autoconnect-priority 10  ipv4.route-metric 600 ipv6.route-metric 600 && echo "wifi: $name -> prioritet 10";;
  esac
done
nmcli -f NAME,TYPE,DEVICE connection show --active

import assert from "node:assert/strict";
import {googleEmbedUrl,navigationLink,mapDestination} from "./motoboy-connect/connect-client.mjs";
const p={lat:-29.12345,lng:-49.12345},key="AIza"+"A".repeat(35),address="Rua QA, 10 · Centro · Sombrio/SC · CEP 88960001 · Apartamento privado";
assert.equal(googleEmbedUrl({key:"",position:p,address}),null);
assert.equal(googleEmbedUrl({key,position:{lat:100,lng:0},address}),null);
const route=new URL(googleEmbedUrl({key,position:p,address}));assert.equal(route.pathname,"/maps/embed/v1/directions");assert.equal(route.searchParams.get("mode"),"driving");assert.equal(route.searchParams.get("origin"),"-29.12345,-49.12345");assert.equal(route.searchParams.get("destination"),mapDestination(address));assert(!route.href.includes("privado"));
const track=new URL(googleEmbedUrl({key,position:p}));assert.equal(track.pathname,"/maps/embed/v1/place");assert.equal(track.searchParams.get("q"),"-29.12345,-49.12345");
const nav=new URL(navigationLink(address));assert.equal(nav.searchParams.get("dir_action"),"navigate");assert.equal(nav.searchParams.get("origin"),null);assert(!nav.href.includes("privado"));
console.log("PASS Maps Embed: rota, posição, navegação oficial e complemento privado omitido.");

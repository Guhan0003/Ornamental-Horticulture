// Run with `npm test`.
import assert from 'node:assert/strict'
import { test } from 'node:test'
import { OTHERS, groupOf, groupPlants } from './groups.js'

const plant = (common_name, scientific_name) => ({ common_name, scientific_name })

const names = (sections) => sections.map((section) => section.name)
const shelf = (sections, name) => sections.find((section) => section.name === name)

test('the genus decides the shelf, under the name people use for it', () => {
  assert.equal(groupOf(plant('Neon Pothos', 'Epipremnum aureum')), 'Pothos')
  assert.equal(groupOf(plant('ZZ Plant', 'Zamioculcas zamiifolia')), 'ZZ Plant')
  assert.equal(groupOf(plant('Peace Lily', 'Spathiphyllum wallisii')), 'Peace Lily')
})

test('Xanadu sits with the Philodendrons, whatever the taxonomists did to it', () => {
  assert.equal(groupOf(plant('Philodendron Xanadu', 'Thaumatophyllum xanadu')), 'Philodendron')
})

test('the three genera sold as Calathea share one shelf', () => {
  assert.equal(groupOf(plant('Peacock Calathea', 'Calathea makoyana')), 'Calathea')
  assert.equal(groupOf(plant('Golden Mosaic', 'Ctenanthe lubbersiana')), 'Calathea')
  assert.equal(groupOf(plant('Beauty Star', 'Goeppertia ornata')), 'Calathea')
})

test('Aglaonemas have a shelf of their own', () => {
  assert.equal(groupOf(plant('Aglaonema Pink Star', "Aglaonema 'Pink Star'")), 'Aglaonema')
})

test('a genus we do not name, or no name at all, has no shelf', () => {
  assert.equal(groupOf(plant('Something New', 'Begonia maculata')), null)
  assert.equal(groupOf(plant('Unlabelled', '')), null)
  assert.equal(groupOf(plant('Unlabelled', undefined)), null)
})

const many = (name, sci, n) => Array.from({ length: n }, (_, i) => plant(`${name} ${i}`, sci))

test('shelves follow the shop order, not their size', () => {
  const sections = groupPlants([
    ...many('Syn', 'Syngonium podophyllum', 7),
    ...many('Pothos', 'Epipremnum aureum', 6),
    ...many('Phil', 'Philodendron hederaceum', 3),
    ...many('Agl', "Aglaonema 'Lipstick'", 2),
    ...many('Cal', 'Calathea makoyana', 2),
    ...many('Fic', 'Ficus elastica', 4),
    ...many('Mon', 'Monstera deliciosa', 5),
    ...many('ZZ', 'Zamioculcas zamiifolia', 2),
    ...many('Anth', 'Anthurium andraeanum', 5),
  ])

  assert.deepEqual(names(sections), [
    'Philodendron',
    'Aglaonema',
    'Anthurium',
    'ZZ Plant',
    'Syngonium',
    'Monstera',
    'Ficus & Rubber Plants',
    'Pothos',
    'Calathea',
  ])
})

test('a listed shelf with too few plants is left out, not left as a gap', () => {
  const sections = groupPlants([
    ...many('Phil', 'Philodendron hederaceum', 3),
    ...many('Anth', 'Anthurium andraeanum', 1),
    ...many('Pothos', 'Epipremnum aureum', 2),
  ])

  assert.deepEqual(names(sections), ['Philodendron', 'Pothos', OTHERS])
  assert.deepEqual(
    shelf(sections, OTHERS).plants.map((p) => p.common_name),
    ['Anth 0'],
  )
})

test('a shelf that is not in the order goes after the listed ones, biggest first', () => {
  const sections = groupPlants([
    ...many('Phil', 'Philodendron hederaceum', 2),
    ...many('Lily', 'Spathiphyllum wallisii', 2),
    ...many('Snake', 'Dracaena trifasciata', 4),
    ...many('Cal', 'Calathea makoyana', 2),
  ])

  assert.deepEqual(names(sections), ['Philodendron', 'Calathea', 'Snake Plant', 'Peace Lily'])
})

test('More plants is always last, whatever else is there', () => {
  const sections = groupPlants([
    ...many('Phil', 'Philodendron hederaceum', 2),
    ...many('Snake', 'Dracaena trifasciata', 3),
    plant('Begonia', 'Begonia maculata'),
  ])

  assert.equal(sections.at(-1).name, OTHERS)
})

test('a genus with one plant in stock is not a shelf, it joins the others', () => {
  const sections = groupPlants([
    plant('Neon Pothos', 'Epipremnum aureum'),
    plant('Jade Pothos', 'Epipremnum aureum'),
    plant('Peace Lily', 'Spathiphyllum wallisii'),
  ])

  assert.deepEqual(names(sections), ['Pothos', OTHERS])
  assert.deepEqual(
    shelf(sections, OTHERS).plants.map((p) => p.common_name),
    ['Peace Lily'],
  )
})

test('with nothing left over there is no More plants shelf', () => {
  const sections = groupPlants([
    plant('Neon Pothos', 'Epipremnum aureum'),
    plant('Jade Pothos', 'Epipremnum aureum'),
  ])

  assert.deepEqual(names(sections), ['Pothos'])
})

test('cards keep the order they arrive in, so the caller’s sort still holds', () => {
  const sections = groupPlants([
    plant('Neon Pothos', 'Epipremnum aureum'),
    plant('Jade Pothos', 'Epipremnum aureum'),
    plant('Marble Queen', 'Epipremnum aureum'),
  ])

  assert.deepEqual(
    shelf(sections, 'Pothos').plants.map((p) => p.common_name),
    ['Neon Pothos', 'Jade Pothos', 'Marble Queen'],
  )
})

test('every plant lands somewhere, exactly once', () => {
  const all = [
    plant('Neon Pothos', 'Epipremnum aureum'),
    plant('Peace Lily', 'Spathiphyllum wallisii'),
    plant('Begonia', 'Begonia maculata'),
    plant('Jade Pothos', 'Epipremnum aureum'),
    plant('Snake Plant', 'Dracaena trifasciata'),
  ]
  const placed = groupPlants(all).flatMap((section) => section.plants)

  assert.equal(placed.length, all.length)
  assert.deepEqual(new Set(placed).size, all.length)
})

test('an empty shop has no shelves', () => {
  assert.deepEqual(groupPlants([]), [])
})

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

test('the biggest shelf comes first, and More plants is always last', () => {
  const sections = groupPlants([
    plant('Syngonium Albo', 'Syngonium podophyllum'),
    plant('Neon Pothos', 'Epipremnum aureum'),
    plant('Monstera Albo', 'Monstera deliciosa'),
    plant('Jade Pothos', 'Epipremnum aureum'),
    plant('Syngonium Panda', 'Syngonium podophyllum'),
    plant('Begonia', 'Begonia maculata'),
    plant('Marble Queen', 'Epipremnum aureum'),
    plant('Monstera Adansonii', 'Monstera adansonii'),
  ])

  assert.deepEqual(names(sections), ['Pothos', 'Monstera', 'Syngonium', OTHERS])
})

test('Aglaonema sits directly under Philodendron, not where its size would put it', () => {
  const many = (name, sci, n) => Array.from({ length: n }, (_, i) => plant(`${name} ${i}`, sci))
  const sections = groupPlants([
    ...many('Phil', 'Philodendron hederaceum', 5),
    ...many('Syn', 'Syngonium podophyllum', 4),
    ...many('Pothos', 'Epipremnum aureum', 3),
    ...many('Agl', "Aglaonema 'Lipstick'", 2),
  ])

  assert.deepEqual(names(sections), ['Philodendron', 'Aglaonema', 'Pothos', 'Syngonium'])
})

test('Anthurium follows Aglaonema, ahead of the bigger Syngonium shelf', () => {
  const many = (name, sci, n) => Array.from({ length: n }, (_, i) => plant(`${name} ${i}`, sci))
  const sections = groupPlants([
    ...many('Phil', 'Philodendron hederaceum', 6),
    ...many('Syn', 'Syngonium podophyllum', 5),
    ...many('Pothos', 'Epipremnum aureum', 4),
    ...many('Anth', 'Anthurium andraeanum', 3),
    ...many('Agl', "Aglaonema 'Lipstick'", 2),
  ])

  assert.deepEqual(names(sections), ['Philodendron', 'Aglaonema', 'Anthurium', 'Pothos', 'Syngonium'])
})

test('ZZ Plant follows Anthurium, so it also sits ahead of Syngonium', () => {
  const many = (name, sci, n) => Array.from({ length: n }, (_, i) => plant(`${name} ${i}`, sci))
  const sections = groupPlants([
    ...many('Phil', 'Philodendron hederaceum', 6),
    ...many('Syn', 'Syngonium podophyllum', 5),
    ...many('Pothos', 'Epipremnum aureum', 4),
    ...many('Anth', 'Anthurium andraeanum', 3),
    ...many('Agl', "Aglaonema 'Lipstick'", 3),
    ...many('ZZ', 'Zamioculcas zamiifolia', 2),
  ])

  assert.deepEqual(names(sections), [
    'Philodendron',
    'Aglaonema',
    'Anthurium',
    'ZZ Plant',
    'Pothos',
    'Syngonium',
  ])
})

test('Pothos follows ZZ Plant, so it sits above the bigger Syngonium shelf', () => {
  const many = (name, sci, n) => Array.from({ length: n }, (_, i) => plant(`${name} ${i}`, sci))
  const sections = groupPlants([
    ...many('Phil', 'Philodendron hederaceum', 6),
    ...many('Syn', 'Syngonium podophyllum', 5),
    ...many('Pothos', 'Epipremnum aureum', 4),
    ...many('ZZ', 'Zamioculcas zamiifolia', 2),
    ...many('Monstera', 'Monstera deliciosa', 3),
  ])

  assert.deepEqual(names(sections), ['Philodendron', 'ZZ Plant', 'Pothos', 'Syngonium', 'Monstera'])
})

test('a pin whose anchor is missing falls back up the chain', () => {
  const many = (name, sci, n) => Array.from({ length: n }, (_, i) => plant(`${name} ${i}`, sci))
  // No Aglaonema or Anthurium shelf: ZZ Plant slots under Philodendron instead,
  // and Pothos still follows ZZ Plant.
  const sections = groupPlants([
    ...many('Phil', 'Philodendron hederaceum', 6),
    ...many('Syn', 'Syngonium podophyllum', 5),
    ...many('Monstera', 'Monstera deliciosa', 4),
    ...many('Pothos', 'Epipremnum aureum', 3),
    ...many('ZZ', 'Zamioculcas zamiifolia', 2),
  ])

  assert.deepEqual(names(sections), ['Philodendron', 'ZZ Plant', 'Pothos', 'Syngonium', 'Monstera'])
})

test('with no Philodendron shelf, Aglaonema keeps its size order', () => {
  const many = (name, sci, n) => Array.from({ length: n }, (_, i) => plant(`${name} ${i}`, sci))
  const sections = groupPlants([
    ...many('Syn', 'Syngonium podophyllum', 4),
    ...many('Agl', "Aglaonema 'Lipstick'", 2),
  ])

  assert.deepEqual(names(sections), ['Syngonium', 'Aglaonema'])
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

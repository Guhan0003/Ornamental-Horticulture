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

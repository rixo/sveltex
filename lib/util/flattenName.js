const flattenRegex = /(?:^_|\$$)/g

const flattenName = name => name.replace(flattenRegex, '')

export default flattenName

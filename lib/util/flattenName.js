const flattenRegex = /(?:^_|_$)/g

const flattenName = name => name.replace(flattenRegex, '')

export default flattenName

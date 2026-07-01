# todo: space underscore mapping
def enum(*sequential, **named):
    enums = dict(list(zip(sequential, list(range(len(sequential))))), **named)
    reverse = dict((value, key) for key, value in list(enums.items()))
    enums['lookup'] = reverse
    return type('Enum', (), enums)

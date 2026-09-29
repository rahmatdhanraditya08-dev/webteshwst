import numpy as np

a = np.array(42)
b = np.array([1, 2, 3, 4, 5])
c = np.array([[1, 2, 3], [4, 5, 6]])
d = np.array([[[1, 2, 3], [4, 5, 6]],
              [[7, 8, 9], [10, 11, 12]]])

print(a)
print("Dimensi a:", a.ndim)
print("Shape a:", a.shape)

print(b)
print("Dimensi b:", b.ndim)
print("Shape b:", b.shape)

print(c)
print("Dimensi c:", c.ndim)
print("Shape c:", c.shape)

print(d)
print("Dimensi d:", d.ndim)
print("Shape d:", d.shape)